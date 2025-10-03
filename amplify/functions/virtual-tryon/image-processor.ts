/**
 * Process and clean image for Bedrock API
 * - Removes EXIF metadata from JPEG images
 * - Uses pure Node.js (no native dependencies)
 */
export class ImageProcessor {
    /**
     * Remove EXIF data from JPEG base64 image
     * This strips the APP1 (EXIF) marker from JPEG files
     */
    static processImageForBedrock(base64Image: string): string {
        try {
            // Convert base64 to buffer
            const inputBuffer = Buffer.from(base64Image, 'base64');

            // Check if it's a JPEG (starts with FF D8)
            if (inputBuffer[0] !== 0xFF || inputBuffer[1] !== 0xD8) {
                // Not a JPEG, return as-is (PNG doesn't have EXIF issues usually)
                console.log('Image is not JPEG, returning as-is');
                return base64Image;
            }

            console.log('Processing JPEG to remove EXIF metadata');

            // Remove EXIF data from JPEG
            const cleanedBuffer = this.stripJPEGExif(inputBuffer);

            // Convert back to base64
            return cleanedBuffer.toString('base64');
        } catch (error) {
            console.error('Error processing image, returning original:', error);
            // If processing fails, return original
            return base64Image;
        }
    }

    /**
     * Strip EXIF data from JPEG buffer
     */
    private static stripJPEGExif(buffer: Buffer): Buffer {
        const chunks: Buffer[] = [];
        let i = 2; // Skip SOI marker (FF D8)

        // Add SOI marker
        chunks.push(Buffer.from([0xFF, 0xD8]));

        while (i < buffer.length - 1) {
            // Check for marker
            if (buffer[i] !== 0xFF) {
                // Not a marker, something's wrong
                console.warn('Invalid JPEG structure, returning original');
                return buffer;
            }

            const marker = buffer[i + 1];

            // Check for APP1 (EXIF) marker (0xE1)
            if (marker === 0xE1) {
                // Skip this segment (EXIF data)
                const segmentLength = buffer.readUInt16BE(i + 2);
                console.log(`Skipping EXIF segment of ${segmentLength} bytes`);
                i += 2 + segmentLength; // Skip marker + length + data
                continue;
            }

            // Check for SOS (Start of Scan) marker (0xDA)
            // After SOS, the rest is compressed image data
            if (marker === 0xDA) {
                // Add SOS and all remaining data
                chunks.push(buffer.subarray(i));
                break;
            }

            // For all other markers, calculate segment length
            if (marker >= 0xD0 && marker <= 0xD9) {
                // Standalone markers (no length field)
                chunks.push(buffer.subarray(i, i + 2));
                i += 2;
            } else {
                // Markers with length field
                const segmentLength = buffer.readUInt16BE(i + 2);
                chunks.push(buffer.subarray(i, i + 2 + segmentLength));
                i += 2 + segmentLength;
            }
        }

        return Buffer.concat(chunks);
    }

    /**
     * Get image info without processing
     */
    static getImageInfo(base64Image: string): {
        format: string;
        width: number;
        height: number;
        hasExif: boolean;
    } {
        try {
            const inputBuffer = Buffer.from(base64Image, 'base64');

            // Check format
            let format = 'unknown';
            let hasExif = false;
            let width = 0;
            let height = 0;

            // Check for JPEG
            if (inputBuffer[0] === 0xFF && inputBuffer[1] === 0xD8) {
                format = 'jpeg';

                // Check for EXIF (APP1 marker)
                let i = 2;
                while (i < Math.min(inputBuffer.length - 1, 1000)) {
                    if (inputBuffer[i] === 0xFF) {
                        const marker = inputBuffer[i + 1];
                        if (marker === 0xE1) {
                            hasExif = true;
                        }
                        // Look for SOF0 marker for dimensions
                        if (marker === 0xC0) {
                            height = inputBuffer.readUInt16BE(i + 5);
                            width = inputBuffer.readUInt16BE(i + 7);
                            break;
                        }
                        // Skip to next marker
                        if (marker >= 0xD0 && marker <= 0xD9) {
                            i += 2;
                        } else {
                            const segmentLength = inputBuffer.readUInt16BE(i + 2);
                            i += 2 + segmentLength;
                        }
                    } else {
                        break;
                    }
                }
            }
            // Check for PNG
            else if (
                inputBuffer[0] === 0x89 &&
                inputBuffer[1] === 0x50 &&
                inputBuffer[2] === 0x4E &&
                inputBuffer[3] === 0x47
            ) {
                format = 'png';
                // PNG dimensions at bytes 16-20
                width = inputBuffer.readUInt32BE(16);
                height = inputBuffer.readUInt32BE(20);
            }

            return {
                format,
                width,
                height,
                hasExif,
            };
        } catch (error) {
            console.error('Error getting image info:', error);
            return {
                format: 'unknown',
                width: 0,
                height: 0,
                hasExif: false,
            };
        }
    }
}