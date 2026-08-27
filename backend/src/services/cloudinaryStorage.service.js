import { v2 as cloudinary } from "cloudinary";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function validationError(message) {
  const error = new Error(message);
  error.status = 422;
  return error;
}

function validateListingPhoto({ buffer, contentType }) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw validationError("Photo file data is required.");
  }
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw validationError("Only JPEG, PNG and WebP images are supported.");
  }
  if (buffer.length > MAX_FILE_BYTES) {
    throw validationError("Each photo must be 8 MB or smaller.");
  }
}

function configuredError(message) {
  const error = new Error(message);
  error.status = 503;
  return error;
}

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw configuredError(`${name} is not configured.`);
  return value;
}

function safeFolderPart(value) {
  return String(value || "unknown")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "unknown";
}

function configureCloudinary() {
  cloudinary.config({
    cloud_name: requiredEnv("CLOUDINARY_CLOUD_NAME").toLowerCase(),
    api_key: requiredEnv("CLOUDINARY_API_KEY"),
    api_secret: requiredEnv("CLOUDINARY_API_SECRET"),
    secure: true
  });
}

const MESSAGE_ATTACHMENT_TYPES = new Map([
  ["image/jpeg", "image"],
  ["image/png", "image"],
  ["image/webp", "image"],
  ["audio/webm", "audio"],
  ["audio/ogg", "audio"],
  ["audio/mpeg", "audio"],
  ["audio/mp4", "audio"],
  ["audio/wav", "audio"]
]);

function validateMessageAttachment({ buffer, contentType, kind }) {
  const expectedKind = MESSAGE_ATTACHMENT_TYPES.get(contentType);
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    const error = new Error("Attachment file data is required.");
    error.status = 422;
    throw error;
  }
  if (!expectedKind || expectedKind !== kind) {
    const error = new Error("Use a JPEG, PNG or WebP image, or a supported audio recording.");
    error.status = 422;
    throw error;
  }
  const maximumBytes = kind === "audio" ? 12 * 1024 * 1024 : 8 * 1024 * 1024;
  if (buffer.length > maximumBytes) {
    const error = new Error(kind === "audio" ? "Voice messages must be 12 MB or smaller." : "Images must be 8 MB or smaller.");
    error.status = 422;
    throw error;
  }
}

export async function uploadCloudinaryMessageAttachment({
  buffer,
  contentType,
  originalName,
  ownerId,
  kind
}) {
  validateMessageAttachment({ buffer, contentType, kind });
  configureCloudinary();

  const folder = `officekhoj/message-${kind}/${safeFolderPart(ownerId)}`;
  const publicId = `${Date.now()}-${safeFolderPart(String(originalName || kind).replace(/\.[^.]+$/, ""))}`;
  let result;
  try {
    result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: kind === "audio" ? "video" : "image",
          overwrite: false,
          use_filename: false
        },
        (error, uploaded) => (error ? reject(error) : resolve(uploaded))
      );
      stream.end(buffer);
    });
  } catch {
    const error = new Error("The message attachment could not be uploaded. Please try again.");
    error.status = 502;
    throw error;
  }

  if (!result?.secure_url || !result?.public_id) {
    const error = new Error("The storage provider returned an invalid attachment response.");
    error.status = 502;
    throw error;
  }

  return {
    url: result.secure_url,
    path: result.public_id,
    name: String(originalName || `${kind}-message`).slice(0, 180),
    contentType,
    size: Number(result.bytes) || buffer.length,
    kind,
    provider: "cloudinary"
  };
}

export async function uploadCloudinaryListingPhoto({
  buffer,
  contentType,
  originalName,
  ownerId,
  listingType
}) {
  validateListingPhoto({ buffer, contentType });
  configureCloudinary();

  const typeFolder = listingType === "profile"
    ? "profile-photos"
    : listingType === "service" ? "service-portfolios" : "property-photos";
  const folder = `officekhoj/${typeFolder}/${safeFolderPart(ownerId)}`;
  const publicId = `${Date.now()}-${safeFolderPart(String(originalName || "photo").replace(/\.[^.]+$/, ""))}`;

  let result;
  try {
    result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: "image",
          overwrite: false,
          use_filename: false
        },
        (error, uploaded) => (error ? reject(error) : resolve(uploaded))
      );
      stream.end(buffer);
    });
  } catch {
    const error = new Error("Cloudinary could not upload the image. Check the server storage configuration.");
    error.status = 502;
    throw error;
  }

  if (!result?.secure_url || !result?.public_id) {
    const error = new Error("Cloudinary returned an invalid upload response.");
    error.status = 502;
    throw error;
  }

  return {
    url: result.secure_url,
    path: result.public_id,
    contentType,
    size: Number(result.bytes) || buffer.length,
    provider: "cloudinary"
  };
}
