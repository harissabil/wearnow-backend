import type {Schema} from "../../data/resource";
import {BedrockImageManipulation, GarmentClass, MergeStyle} from './bedrock-client';
import {S3Utils} from './s3-utils';

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

        // Step 2: Validate images
        if (!BedrockImageManipulation.validateImageFormat(userPhotoBase64)) {
            throw new Error('User photo is not in a supported format (JPEG or PNG)');
        }

        if (!BedrockImageManipulation.validateImageFormat(garmentPhotoBase64)) {
            throw new Error('Garment photo is not in a supported format (JPEG or PNG)');
        }

        // Check image sizes
        const userPhotoSize = BedrockImageManipulation.getImageSize(userPhotoBase64);
        const garmentPhotoSize = BedrockImageManipulation.getImageSize(garmentPhotoBase64);

        console.log(`User photo size: ${userPhotoSize} bytes (${(userPhotoSize / 1024 / 1024).toFixed(2)} MB)`);
        console.log(`Garment photo size: ${garmentPhotoSize} bytes (${(garmentPhotoSize / 1024 / 1024).toFixed(2)} MB)`);
        console.log(`User photo format: ${userPhotoBase64.startsWith('/9j/') ? 'JPEG' : 'PNG'}`);
        console.log(`Garment photo format: ${garmentPhotoBase64.startsWith('/9j/') ? 'JPEG' : 'PNG'}`);

        // Get and log image dimensions
        const userPhotoDimensions = BedrockImageManipulation.getImageDimensions(userPhotoBase64);
        const garmentPhotoDimensions = BedrockImageManipulation.getImageDimensions(garmentPhotoBase64);

        if (userPhotoDimensions) {
            console.log(`User photo dimensions: ${userPhotoDimensions.width}x${userPhotoDimensions.height}`);
        } else {
            console.warn('Could not extract user photo dimensions');
        }

        if (garmentPhotoDimensions) {
            console.log(`Garment photo dimensions: ${garmentPhotoDimensions.width}x${garmentPhotoDimensions.height}`);
        } else {
            console.warn('Could not extract garment photo dimensions');
        }

        if (userPhotoSize > MAX_IMAGE_SIZE || garmentPhotoSize > MAX_IMAGE_SIZE) {
            throw new Error('Image size exceeds maximum allowed size (10MB)');
        }

        console.log('Images validated successfully');

        // Step 3: Call Bedrock for virtual try-on
        console.log('Calling Bedrock Nova Canvas for virtual try-on...');
        const result = await bedrockClient.virtualTryOn({
            sourceImage: userPhotoBase64,
            referenceImage: garmentPhotoBase64,
            garmentClass: (garmentClass as GarmentClass) || 'UPPER_BODY',
            maskShape: 'CONTOUR',
            mergeStyle: (mergeStyle as MergeStyle) || 'SEAMLESS',
        });

        console.log('Virtual try-on completed successfully');

        // Step 4: Upload result to S3
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
