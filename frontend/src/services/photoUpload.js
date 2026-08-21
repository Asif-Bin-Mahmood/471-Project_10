import { API_BASE, getAuthToken } from "../api/client.js";

const MAX_FILES = 6;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function validateFile(file) {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(`${file.name}: only JPEG, PNG and WebP images are allowed.`);
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`${file.name}: each photo must be 8 MB or smaller.`);
  }
}

export async function uploadOneListingPhoto(file, listingType) {
  validateFile(file);

  const token = getAuthToken();
  if (!token) throw new Error("Please sign in before uploading photos.");

  const response = await fetch(`${API_BASE}/uploads/listing-photo`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": file.type,
      "X-File-Name": encodeURIComponent(file.name),
      "X-Listing-Type": listingType
    },
    body: file
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Photo upload failed: ${response.status}`);
  }

  return data.photo;
}

export async function uploadListingPhotos(files, listingType, existingCount = 0) {
  const selected = Array.from(files || []);
  if (!selected.length) return [];
  if (existingCount + selected.length > MAX_FILES) {
    throw new Error(`A listing can contain up to ${MAX_FILES} photos.`);
  }

  const uploaded = [];
  for (const file of selected) {
    uploaded.push(await uploadOneListingPhoto(file, listingType));
  }
  return uploaded;
}

export async function uploadProfilePhoto(file, userId) {
  validateFile(file);

  const token = getAuthToken();
  if (!token) throw new Error("Please sign in before uploading a profile photo.");

  const response = await fetch(`${API_BASE}/profile/${encodeURIComponent(userId)}/photo`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": file.type,
      "X-File-Name": encodeURIComponent(file.name)
    },
    body: file
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Profile photo upload failed: ${response.status}`);
  return data;
}
