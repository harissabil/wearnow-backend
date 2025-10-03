import {defineFunction} from '@aws-amplify/backend';

export const imageProcessorFunction = defineFunction({
    name: 'image-processor',
    entry: './handler.ts',
    timeoutSeconds: 60,
    memoryMB: 512,
    environment: {
        THUMBNAIL_SIZE: '256',
    },
});
