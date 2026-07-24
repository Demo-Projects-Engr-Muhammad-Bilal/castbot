import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import fs from 'fs';

// Configure Cloudinary directly from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a local video file to Cloudinary using a read stream.
 * Forces resource_type to "video" and returns the secure URL.
 * 
 * @param localPath The absolute or relative path to the local video file.
 * @returns Promise resolving to the secure URL of the uploaded video.
 */
export async function uploadLocalVideoToCloudinary(localPath: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (!fs.existsSync(localPath)) {
      return reject(new Error(`Local file not found at path: ${localPath}`));
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'video',
      },
      (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
        if (error) {
          return reject(new Error(`Cloudinary upload failed: ${error.message}`));
        }
        if (!result) {
          return reject(new Error('Cloudinary upload returned no result.'));
        }
        resolve(result.secure_url);
      }
    );

    fs.createReadStream(localPath).pipe(uploadStream);
  });
}

export default uploadLocalVideoToCloudinary;
