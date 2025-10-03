import type {Schema} from "../../data/resource";
import {BedrockImageManipulation, GarmentClass, MergeStyle} from './bedrock-client';
import {S3Utils} from './s3-utils';
import {ImageProcessor} from './image-processor';

export const handler: Schema["virtualTryOn"]["functionHandler"] = async (event) => {
    const startTime = Date.now();

    console.log('Virtual Try-On Request:', JSON.stringify(event, null, 2));

    const {
        userId,
        userPhotoId,
        userPhotoUrl,
        garmentPhotoUrl,
        historyId,
        garmentClass,
        maskType,
        mergeStyle,
    } = event.arguments;

    // Validate required fields
    if (!userId || !userPhotoUrl || !garmentPhotoUrl || !historyId) {
        return {
            success: false,
            historyId: historyId || '',
            errorMessage: 'Missing required fields: userId, userPhotoUrl, garmentPhotoUrl, or historyId',
        };
    }

    // Environment variables
    const BEDROCK_REGION = process.env.BEDROCK_REGION || 'us-east-1';
    const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'amazon.nova-canvas-v1:0';
    const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
    const MAX_IMAGE_SIZE = parseInt(process.env.MAX_IMAGE_SIZE || '10485760'); // 10MB

    if (!S3_BUCKET_NAME) {
        return {
            success: false,
            historyId,
            errorMessage: 'S3_BUCKET_NAME environment variable not configured',
        };
    }

    try {
        // Initialize clients
        const s3Utils = new S3Utils(BEDROCK_REGION, S3_BUCKET_NAME);
        const bedrockClient = new BedrockImageManipulation(BEDROCK_REGION, BEDROCK_MODEL_ID);

        // Step 1: Download images from S3
        console.log('Downloading user photo from S3...');
        const userPhotoKey = S3Utils.extractS3Key(userPhotoUrl);
        const userPhotoBase64 = await s3Utils.downloadImageAsBase64(userPhotoKey);

        console.log('Downloading garment photo from S3...');
        const garmentPhotoKey = S3Utils.extractS3Key(garmentPhotoUrl);
        const garmentPhotoBase64 = await s3Utils.downloadImageAsBase64(garmentPhotoKey);

        // Step 2: Process images to remove EXIF and clean for Bedrock
        console.log('Processing images to remove EXIF metadata and optimize for Bedrock...');

        const userPhotoInfo = ImageProcessor.getImageInfo(userPhotoBase64);
        console.log('Original user photo info:', userPhotoInfo);

        const garmentPhotoInfo = ImageProcessor.getImageInfo(garmentPhotoBase64);
        console.log('Original garment photo info:', garmentPhotoInfo);

        // Process images to remove EXIF and optimize
        const cleanUserPhotoBase64 = ImageProcessor.processImageForBedrock(userPhotoBase64);
        const cleanGarmentPhotoBase64 = ImageProcessor.processImageForBedrock(garmentPhotoBase64);

        console.log('Images processed and cleaned for Bedrock');

        // Step 3: Validate images
        if (!BedrockImageManipulation.validateImageFormat(cleanUserPhotoBase64)) {
            throw new Error('User photo is not in a supported format (JPEG or PNG)');
        }

        if (!BedrockImageManipulation.validateImageFormat(cleanGarmentPhotoBase64)) {
            throw new Error('Garment photo is not in a supported format (JPEG or PNG)');
        }

        // Check image sizes
        const userPhotoSize = BedrockImageManipulation.getImageSize(cleanUserPhotoBase64);
        const garmentPhotoSize = BedrockImageManipulation.getImageSize(cleanGarmentPhotoBase64);

        console.log(`Processed user photo size: ${userPhotoSize} bytes (${(userPhotoSize / 1024 / 1024).toFixed(2)} MB)`);
        console.log(`Processed garment photo size: ${garmentPhotoSize} bytes (${(garmentPhotoSize / 1024 / 1024).toFixed(2)} MB)`);

        // Get and log processed image dimensions
        const processedUserPhotoDimensions = BedrockImageManipulation.getImageDimensions(cleanUserPhotoBase64);
        const processedGarmentPhotoDimensions = BedrockImageManipulation.getImageDimensions(cleanGarmentPhotoBase64);

        if (processedUserPhotoDimensions) {
            console.log(`Processed user photo dimensions: ${processedUserPhotoDimensions.width}x${processedUserPhotoDimensions.height}`);

            // Check if dimensions exceed Bedrock's limit (2048x2048 = 4,194,304 pixels)
            const userPhotoPixelCount = processedUserPhotoDimensions.width * processedUserPhotoDimensions.height;
            const maxPixelCount = 4194304; // 2048 x 2048

            if (userPhotoPixelCount > maxPixelCount) {
                throw new Error(
                    `User photo is too large (${processedUserPhotoDimensions.width}x${processedUserPhotoDimensions.height} = ${userPhotoPixelCount.toLocaleString()} pixels). ` +
                    `Maximum allowed is 2048x2048 (4,194,304 pixels). Please resize the image before uploading.`
                );
            }
        }

        if (processedGarmentPhotoDimensions) {
            console.log(`Processed garment photo dimensions: ${processedGarmentPhotoDimensions.width}x${processedGarmentPhotoDimensions.height}`);

            // Check if dimensions exceed Bedrock's limit
            const garmentPhotoPixelCount = processedGarmentPhotoDimensions.width * processedGarmentPhotoDimensions.height;
            const maxPixelCount = 4194304; // 2048 x 2048

            if (garmentPhotoPixelCount > maxPixelCount) {
                throw new Error(
                    `Garment photo is too large (${processedGarmentPhotoDimensions.width}x${processedGarmentPhotoDimensions.height} = ${garmentPhotoPixelCount.toLocaleString()} pixels). ` +
                    `Maximum allowed is 2048x2048 (4,194,304 pixels). Please resize the image before uploading.`
                );
            }
        }

        if (userPhotoSize > MAX_IMAGE_SIZE || garmentPhotoSize > MAX_IMAGE_SIZE) {
            throw new Error('Image size exceeds maximum allowed size (10MB)');
        }

        console.log('Images validated successfully');

        // Step 4: Call Bedrock for virtual try-on with cleaned images
        console.log('Calling Bedrock Nova Canvas for virtual try-on...');
        const result = await bedrockClient.virtualTryOn({
            sourceImage: cleanUserPhotoBase64,
            referenceImage: cleanGarmentPhotoBase64,
            garmentClass: (garmentClass as GarmentClass) || 'UPPER_BODY',
            maskShape: 'CONTOUR',
            mergeStyle: (mergeStyle as MergeStyle) || 'SEAMLESS',
        });

        console.log('Virtual try-on completed successfully');

        // Step 5: Upload result to S3
        const resultKey = `tryon-results/${userId}/result-${historyId}.jpg`;
        console.log('Uploading result to S3:', resultKey);

        const contentType = S3Utils.getContentType(result.image);
        await s3Utils.uploadBase64Image(resultKey, result.image, contentType);

        const processingTime = Date.now() - startTime;

        return {
            success: true,
            historyId,
            resultUrl: resultKey,
            processingTime,
        };

    } catch (error) {
        console.error('Virtual try-on error:', error);

        const processingTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

        return {
            success: false,
            historyId,
            errorMessage,
            processingTime,
        };
    }
};
