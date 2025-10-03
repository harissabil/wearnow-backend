import type {S3Handler} from 'aws-lambda';
import {GetObjectCommand, PutObjectCommand, S3Client} from '@aws-sdk/client-s3';
import sharp from 'sharp';

export const handler: S3Handler = async (event) => {
    const s3Client = new S3Client({});
    const THUMBNAIL_SIZE = parseInt(process.env.THUMBNAIL_SIZE || '256');

    for (const record of event.Records) {
        const bucket = record.s3.bucket.name;
        const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

        // Skip if already a thumbnail
        if (key.includes('thumb-')) {
            console.log('Skipping thumbnail:', key);
            continue;
        }

        // Only process certain directories
        const shouldProcess =
            key.startsWith('user-photos/') ||
            key.startsWith('tryon-results/');

        if (!shouldProcess) {
            console.log('Skipping non-image path:', key);
            continue;
        }

        try {
            console.log('Processing image:', key);

            // Download the image
            const getCommand = new GetObjectCommand({Bucket: bucket, Key: key});
            const response = await s3Client.send(getCommand);

            if (!response.Body) {
                console.error('No body in S3 response');
                continue;
            }

            // Convert stream to buffer
            const chunks: Uint8Array[] = [];
            for await (const chunk of response.Body as any) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);

            // Create thumbnail using sharp
            const thumbnail = await sharp(buffer)
                .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
                    fit: 'cover',
                    position: 'center',
                })
                .jpeg({quality: 80})
                .toBuffer();

            // Generate thumbnail key
            const pathParts = key.split('/');
            const fileName = pathParts[pathParts.length - 1];
            pathParts[pathParts.length - 1] = `thumb-${fileName.replace(/\.[^.]+$/, '.jpg')}`;
            const thumbKey = pathParts.join('/');

            // Upload thumbnail
            const putCommand = new PutObjectCommand({
                Bucket: bucket,
                Key: thumbKey,
                Body: thumbnail,
                ContentType: 'image/jpeg',
            });

            await s3Client.send(putCommand);
            console.log('Thumbnail created:', thumbKey);

        } catch (error) {
            console.error('Error processing image:', error);
            // Continue processing other images even if one fails
        }
    }
};

