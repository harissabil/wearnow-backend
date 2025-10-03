import {
    BedrockRuntimeClient,
    InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

export type GarmentClass =
    | 'UPPER_BODY'
    | 'LOWER_BODY'
    | 'FULL_BODY'
    | 'FOOTWEAR'
    | 'LONG_SLEEVE_SHIRT'
    | 'SHORT_SLEEVE_SHIRT'
    | 'NO_SLEEVE_SHIRT'
    | 'OTHER_UPPER_BODY'
    | 'LONG_PANTS'
    | 'SHORT_PANTS'
    | 'OTHER_LOWER_BODY'
    | 'LONG_DRESS'
    | 'SHORT_DRESS'
    | 'FULL_BODY_OUTFIT'
    | 'OTHER_FULL_BODY'
    | 'SHOES'
    | 'BOOTS'
    | 'OTHER_FOOTWEAR';

export type MergeStyle = 'BALANCED' | 'SEAMLESS' | 'DETAILED';

export type MaskShape = 'CONTOUR' | 'BOUNDING_BOX' | 'DEFAULT';

export interface VirtualTryOnParams {
    sourceImage: string; // base64 encoded user photo
    referenceImage: string; // base64 encoded garment photo
    garmentClass?: GarmentClass;
    maskShape?: MaskShape;
    mergeStyle?: MergeStyle;
}

export interface VirtualTryOnResult {
    image: string; // base64 encoded result image
    finishReason: string;
}

export class BedrockImageManipulation {
    private client: BedrockRuntimeClient;
    private modelId: string;

    constructor(region: string = 'us-east-1', modelId: string = 'amazon.nova-canvas-v1:0') {
        this.client = new BedrockRuntimeClient({region: 'us-east-1'});
        this.modelId = modelId;
    }

    async virtualTryOn(params: VirtualTryOnParams): Promise<VirtualTryOnResult> {
        const {
            sourceImage,
            referenceImage,
            garmentClass = 'UPPER_BODY',
            maskShape = 'CONTOUR',
            mergeStyle = 'SEAMLESS',
        } = params;

        // Prepare the request payload for Amazon Bedrock Nova Canvas
        // Based on AWS Hero's working example
        const requestBody = {
            taskType: 'VIRTUAL_TRY_ON',
            virtualTryOnParams: {
                sourceImage: sourceImage,
                referenceImage: referenceImage,
                maskType: 'GARMENT',
                garmentBasedMask: {
                    maskShape: maskShape,
                    garmentClass: garmentClass,
                },
                maskExclusions: {
                    preserveFace: 'ON',
                    preserveHands: 'ON',
                    preserveBodyPose: 'ON',
                },
                mergeStyle: mergeStyle,
                returnMask: false,
            },
            imageGenerationConfig: {
                numberOfImages: 1,
                quality: 'premium',
                cfgScale: 7.5,
            },
        };

        try {
            console.log('Sending request to Bedrock with payload:', JSON.stringify({
                ...requestBody,
                virtualTryOnParams: {
                    ...requestBody.virtualTryOnParams,
                    sourceImage: sourceImage.substring(0, 30) + '...[TRUNCATED]',
                    referenceImage: referenceImage.substring(0, 30) + '...[TRUNCATED]',
                }
            }));

            const command = new InvokeModelCommand({
                modelId: this.modelId,
                body: JSON.stringify(requestBody),
                contentType: 'application/json',
                accept: 'application/json',
            });

            const response = await this.client.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));

            console.log('Bedrock response status:', response.$metadata);
            console.log('Bedrock response body keys:', Object.keys(responseBody));
            console.log('Bedrock response:', JSON.stringify({
                ...responseBody,
                images: responseBody.images ? `[${responseBody.images.length} images]` : undefined,
                error: responseBody.error,
                maskImage: responseBody.maskImage ? '[MASK_DATA]' : undefined
            }));

            // Check for error field in response (from documentation: error field contains error info)
            if (responseBody.error) {
                throw new Error(`Bedrock API error: ${responseBody.error}`);
            }

            if (!responseBody.images || responseBody.images.length === 0) {
                throw new Error('No images returned from Bedrock - all images may have been blocked by content moderation or input validation failed');
            }

            return {
                image: responseBody.images[0],
                finishReason: responseBody.finishReason || 'SUCCESS',
            };
        } catch (error) {
            console.error('Bedrock API error:', error);

            // If it's a Bedrock service error, try to extract more details
            if (error && typeof error === 'object' && 'message' in error) {
                const errorMessage = (error as any).message;
                console.error('Detailed error message:', errorMessage);

                // Check if this is a validation error from Bedrock
                if (errorMessage.includes('ValidationException') || errorMessage.includes('Invalid Input')) {
                    throw new Error(`Invalid Input: The input does not adhere to the expected standards. Please refer to the model user guide and adjust the input before trying again.`);
                }
            }

            throw new Error(`Virtual try-on failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Validates if the base64 image is in a supported format
     */
    static validateImageFormat(base64Image: string): boolean {
        try {
            const buffer = Buffer.from(base64Image, 'base64');

            // Check for JPEG (FF D8)
            const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8;

            // Check for PNG (89 50 4E 47)
            const isPNG = buffer[0] === 0x89 &&
                          buffer[1] === 0x50 &&
                          buffer[2] === 0x4E &&
                          buffer[3] === 0x47;

            if (isJPEG) {
                console.log('Image validated as JPEG');
            } else if (isPNG) {
                console.log('Image validated as PNG');
            } else {
                console.log(`Image validation failed - first 4 bytes: ${buffer.slice(0, 4).toString('hex')}`);
            }

            return isJPEG || isPNG;
        } catch (error) {
            console.error('Error validating image format:', error);
            return false;
        }
    }

    /**
     * Estimates image size in bytes from base64 string
     */
    static getImageSize(base64Image: string): number {
        const padding = (base64Image.match(/=/g) || []).length;
        return (base64Image.length * 0.75) - padding;
    }

    /**
     * Get image dimensions from base64 encoded image
     */
    static getImageDimensions(base64Image: string): { width: number; height: number } | null {
        try {
            const buffer = Buffer.from(base64Image, 'base64');

            // Check for PNG
            if (base64Image.startsWith('iVBORw0KGgo')) {
                // PNG header at bytes 16-24 contains width and height
                const width = buffer.readUInt32BE(16);
                const height = buffer.readUInt32BE(20);
                return {width, height};
            }

            // Check for JPEG
            if (base64Image.startsWith('/9j/')) {
                // JPEG dimension extraction is more complex, but we can try a simple approach
                // Look for SOF0 (Start of Frame) marker (0xFFC0)
                for (let i = 0; i < buffer.length - 9; i++) {
                    if (buffer[i] === 0xFF && buffer[i + 1] === 0xC0) {
                        const height = buffer.readUInt16BE(i + 5);
                        const width = buffer.readUInt16BE(i + 7);
                        return {width, height};
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('Error getting image dimensions:', error);
            return null;
        }
    }
}
