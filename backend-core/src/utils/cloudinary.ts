import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

// Note: Ensure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET are in .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export const uploadToCloudinary = async (localFilePath: string): Promise<string | null> => {
  try {
    if (!localFilePath || !fs.existsSync(localFilePath)) return null;
    
    // Only attempt upload if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      console.warn('Cloudinary not configured. Cannot upload image.');
      return null;
    }

    const response = await cloudinary.uploader.upload(localFilePath, {
      folder: 'cira-quiz-images',
      resource_type: 'auto'
    });
    
    return response.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    return null;
  } finally {
    // Clean up local temp file
    if (localFilePath && fs.existsSync(localFilePath)) {
      try {
        fs.unlinkSync(localFilePath);
      } catch (e) {
        console.error('Failed to clean up temp file:', localFilePath);
      }
    }
  }
};
