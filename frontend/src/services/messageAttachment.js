import { API_BASE, getAuthToken } from "../api/client.js";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AUDIO_TYPES = new Set(["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav"]);

export async function uploadMessageAttachment(file, kind, conversationId) {
  const contentType = String(file?.type || "").split(";")[0].toLowerCase();
  const allowed = kind === "audio" ? AUDIO_TYPES : IMAGE_TYPES;
  const maximumBytes = kind === "audio" ? 12 * 1024 * 1024 : 8 * 1024 * 1024;
  if (!file || !allowed.has(contentType)) {
    throw new Error(kind === "audio" ? "This voice recording format is not supported." : "Choose a JPEG, PNG or WebP image.");
  }
  if (file.size > maximumBytes) {
    throw new Error(kind === "audio" ? "Voice messages must be 12 MB or smaller." : "Images must be 8 MB or smaller.");
  }

  const token = getAuthToken();
  if (!token) throw new Error("Please sign in before sending an attachment.");
  if (!conversationId) throw new Error("Choose a conversation before uploading an attachment.");
  const response = await fetch(`${API_BASE}/uploads/message-attachment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType,
      "X-File-Name": encodeURIComponent(file.name || `${kind}-message`),
      "X-Attachment-Kind": kind,
      "X-Conversation-Id": conversationId
    },
    body: file
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Attachment upload failed: ${response.status}`);
  return data.attachment;
}
