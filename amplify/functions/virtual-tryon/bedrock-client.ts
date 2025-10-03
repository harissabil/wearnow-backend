import {
    BedrockRuntimeClient,
    InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

export type GarmentClass =
    | 'UPPER_BODY'
    | 'LOWER_BODY'
    | 'FULL_BODY'
    | 'FOOTWEAR';

export type MergeStyle = 'BALANCED' | 'SEAMLESS' | 'DETAILED';

export interface VirtualTryOnParams {
    sourceImage: string; // base64 encoded user photo
    referenceImage: string; // base64 encoded garment photo
    garmentClass?: GarmentClass;
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
        this.client = new BedrockRuntimeClient({region});
        this.modelId = modelId;
    }

    async virtualTryOn(params: VirtualTryOnParams): Promise<VirtualTryOnResult> {
        const {
            sourceImage,
            referenceImage,
            garmentClass = 'UPPER_BODY',
            mergeStyle = 'BALANCED',
        } = params;

        // Prepare the request payload for Amazon Bedrock Nova Canvas
        const requestBody = {
            taskType: 'VIRTUAL_TRY_ON',
            virtualTryOnParams: {
                sourceImage: sourceImage,
                referenceImage: referenceImage,
                maskType: 'GARMENT',
                garmentBasedMask: {
                    maskShape: 'DEFAULT',
                    garmentClass: garmentClass,
                },
                maskExclusions: {
                    preserveBodyPose: 'ON',
                    preserveHands: 'ON',
                    preserveFace: 'ON',
                },
                mergeStyle: mergeStyle,
            },
            imageGenerationConfig: {
                numberOfImages: 1,
                quality: 'premium',
                width: 1024,
                height: 1024,
            },
        };

        try {
            const command = new InvokeModelCommand({
                modelId: this.modelId,
                contentType: 'application/json',
                accept: 'application/json',
                body: JSON.stringify(requestBody),
            });

            const response = await this.client.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(response.body));

            if (!responseBody.images || responseBody.images.length === 0) {
                throw new Error('No images returned from Bedrock');
            }

            return {
                image: responseBody.images[0],
                finishReason: responseBody.finishReason || 'SUCCESS',
            };
        } catch (error) {
            console.error('Bedrock API error:', error);
            throw new Error(`Virtual try-on failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Validates if the base64 image is in a supported format
     */
    static validateImageFormat(base64Image: string): boolean {
        // Check for JPEG or PNG headers in base64
        return base64Image.startsWith('/9j/') || // JPEG
            base64Image.startsWith('iVBORw0KGgo'); // PNG
    }

    /**
     * Estimates image size in bytes from base64 string
     */
    static getImageSize(base64Image: string): number {
        const padding = (base64Image.match(/=/g) || []).length;
        return (base64Image.length * 0.75) - padding;
    }
}

