import {defineFunction} from '@aws-amplify/backend';

export const virtualTryonFunction = defineFunction({
    name: 'virtual-tryon',
    entry: './handler.ts',
    timeoutSeconds: 300, // 5 minutes for Bedrock processing
    memoryMB: 1024,
    environment: {
        BEDROCK_REGION: 'us-east-1',
        BEDROCK_MODEL_ID: 'amazon.nova-canvas-v1:0',
        MAX_IMAGE_SIZE: '10485760', // 10MB
        THUMBNAIL_SIZE: '256',
    },
});

