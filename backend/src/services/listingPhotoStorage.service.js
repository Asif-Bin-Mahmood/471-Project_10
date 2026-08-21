import { uploadCloudinaryListingPhoto } from "./cloudinaryStorage.service.js";
import { uploadListingPhoto as uploadFirebaseListingPhoto } from "./firebaseStorage.service.js";

const providers = {
  cloudinary: uploadCloudinaryListingPhoto,
  firebase: uploadFirebaseListingPhoto
};

export async function uploadListingPhoto(options) {
  const provider = String(process.env.UPLOAD_STORAGE_PROVIDER || "cloudinary")
    .trim()
    .toLowerCase();
  const upload = providers[provider];

  if (!upload) {
    const error = new Error("UPLOAD_STORAGE_PROVIDER must be cloudinary or firebase.");
    error.status = 503;
    throw error;
  }

  return upload(options);
}
