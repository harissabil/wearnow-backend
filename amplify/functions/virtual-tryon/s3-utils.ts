import {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
    DeleteObjectCommand,
} from '@aws-sdk/client-s3';

export class S3Utils {
    private client: S3Client;
    private bucketName: string;

    constructor(region: string = 'ap-southeast-1', bucketName: string) {
        this.client = new S3Client({region: 'ap-southeast-1'});
        this.bucketName = bucketName;
    }

    /**
     * Download an image from S3 and convert to base64
     */
    async downloadImageAsBase64(key: string): Promise<string> {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });

            const response = await this.client.send(command);

            if (!response.Body) {
                throw new Error('No body in S3 response');
            }

            // Convert stream to buffer
            const chunks: Uint8Array[] = [];
            for await (const chunk of response.Body as any) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);

            // Convert to base64
            return buffer.toString('base64');
        } catch (error) {
            console.error('Error downloading from S3:', error);
            throw new Error(`Failed to download image from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Upload base64 image to S3
     */
    async uploadBase64Image(
        key: string,
        base64Image: string,
        contentType: string = 'image/jpeg'
    ): Promise<string> {
        try {
            const buffer = Buffer.from(base64Image, 'base64');

            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: buffer,
                ContentType: contentType,
            });

            await this.client.send(command);
            return key;
        } catch (error) {
            console.error('Error uploading to S3:', error);
            throw new Error(`Failed to upload image to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Delete an object from S3
     */
    async deleteObject(key: string): Promise<void> {
        try {
            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });

            await this.client.send(command);
        } catch (error) {
            console.error('Error deleting from S3:', error);
            throw new Error(`Failed to delete image from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Extract S3 key from full URL or path
     */
    static extractS3Key(urlOrKey: string): string {
        // If it's already just a key, return it
        if (!urlOrKey.includes('://')) {
            return urlOrKey;
        }

        // Extract key from S3 URL
        try {
            const url = new URL(urlOrKey);
            // Handle both s3:// and https:// URLs
            const pathParts = url.pathname.split('/').filter(p => p);
            return pathParts.join('/');
        } catch {
            // If URL parsing fails, assume it's already a key
            return urlOrKey;
        }
    }

    /**
     * Determine content type from base64 image data
     */
    static getContentType(base64Image: string): string {
        if (base64Image.startsWith('/9j/')) {
            return 'image/jpeg';
        } else if (base64Image.startsWith('iVBORw0KGgo')) {
            return 'image/png';
        }
        return 'image/jpeg'; // default
    }
}

