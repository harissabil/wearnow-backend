import sharp from 'sharp';

/**
 * Process and clean image for Bedrock API
 * - Removes EXIF metadata
 * - Ensures proper JPEG format
 * - Optionally resizes to max dimensions
 */
export class ImageProcessor {
    /**
     * Process base64 image: remove EXIF, optimize, and return clean base64
     */
    static async processImageForBedrock(
        base64Image: string,
        maxWidth: number = 2048,
        maxHeight: number = 2048
    ): Promise<string> {
        try {
            // Convert base64 to buffer
            const inputBuffer = Buffer.from(base64Image, 'base64');

            // Process image with sharp:
            // 1. Remove EXIF and other metadata
            // 2. Ensure it's in JPEG format
            // 3. Resize if needed while maintaining aspect ratio
            // 4. Optimize quality
            const processedBuffer = await sharp(inputBuffer)
                .rotate() // Auto-rotate based on EXIF orientation, then strip EXIF
                .resize(maxWidth, maxHeight, {
                    fit: 'inside',
                    withoutEnlargement: true,
                })
                .jpeg({
                    quality: 90,
                    mozjpeg: true, // Use mozjpeg for better compression
                })
                .withMetadata({
                    // Strip all metadata
                    exif: {},
                })
                .toBuffer();

            // Convert back to base64
            return processedBuffer.toString('base64');
        } catch (error) {
            console.error('Error processing image:', error);
            throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get image info without processing
     */
    static async getImageInfo(base64Image: string): Promise<{
        format: string;
        width: number;
        height: number;
        hasExif: boolean;
    }> {
        try {
            const inputBuffer = Buffer.from(base64Image, 'base64');
            const metadata = await sharp(inputBuffer).metadata();

            return {
                format: metadata.format || 'unknown',
                width: metadata.width || 0,
                height: metadata.height || 0,
                hasExif: !!metadata.exif,
            };
        } catch (error) {
            console.error('Error getting image info:', error);
            throw new Error(`Failed to get image info: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}