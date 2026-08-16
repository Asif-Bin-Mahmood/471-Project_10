import crypto from "node:crypto";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

let firebaseAppPromise = null;

function configuredError(message) {
  const error = new Error(message);
  error.status = 503;
  return error;
}

function validationError(message) {
  const error = new Error(message);
  error.status = 422;
  return error;
}

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw configuredError(`${name} is not configured.`);
  return value;
}

function safeFileName(name = "photo") {
  const cleaned = String(name)
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return cleaned || "photo";
}

function serviceAccountFromEnv() {
  const projectId = String(process.env.FIREBASE_PROJECT_ID || "").trim();
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || "").trim();
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || "")
    .replace(/\\n/g, "\n")
    .trim();

  if (!projectId && !clientEmail && !privateKey) return null;
  if (!projectId || !clientEmail || !privateKey) {
    throw configuredError(
      "FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY must all be configured together."
    );
  }

  return { projectId, clientEmail, privateKey };
}

async function getFirebaseApp() {
  if (!firebaseAppPromise) {
    firebaseAppPromise = (async () => {
      const { applicationDefault, cert, getApps, initializeApp } = await import(
        "firebase-admin/app"
      );

      const existing = getApps()[0];
      if (existing) return existing;

      const storageBucket = requiredEnv("FIREBASE_STORAGE_BUCKET");
      const serviceAccount = serviceAccountFromEnv();
      const credential = serviceAccount ? cert(serviceAccount) : applicationDefault();

      return initializeApp({ credential, storageBucket });
    })();
  }

  return firebaseAppPromise;
}

export function validateListingPhoto({ buffer, contentType }) {
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

export async function uploadListingPhoto({
  buffer,
  contentType,
  originalName,
  ownerId,
  listingType
}) {
  validateListingPhoto({ buffer, contentType });

  const app = await getFirebaseApp();
  const { getDownloadURL, getStorage } = await import("firebase-admin/storage");
  const bucketName = requiredEnv("FIREBASE_STORAGE_BUCKET");
  const bucket = getStorage(app).bucket(bucketName);

  const ownerFolder = safeFileName(ownerId);
  const typeFolder = listingType === "service" ? "service-portfolios" : "property-photos";
  const objectName = `${Date.now()}-${crypto.randomUUID()}-${safeFileName(originalName)}`;
  const objectPath = `officekhoj/${typeFolder}/${ownerFolder}/${objectName}`;
  const file = bucket.file(objectPath);

  await file.save(buffer, {
    resumable: false,
    metadata: {
      contentType,
      cacheControl: "public,max-age=31536000,immutable",
      metadata: {
        ownerId: String(ownerId),
        listingType
      }
    }
  });

  const url = await getDownloadURL(file);
  return {
    url,
    path: objectPath,
    contentType,
    size: buffer.length
  };
}
