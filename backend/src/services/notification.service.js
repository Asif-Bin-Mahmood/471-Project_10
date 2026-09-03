import Notification from "../models/Notification.js";
import { emitNotification } from "../realtime/socket.js";

// Every in-app notification is raised here: the record is persisted first so it
// survives for a recipient who is offline, then pushed to that user's socket
// room for live delivery. A realtime failure is logged and never propagates,
// so the action that raised the notification always completes.
export async function notifyUser(io, { user, type, title, message }) {
  const recipient = user?._id || user;
  if (!recipient) return null;

  const notification = await Notification.create({ user: recipient, type, title, message });
  try {
    emitNotification(io, notification);
  } catch (error) {
    console.error(`[notification] realtime delivery failed: ${error.message}`);
  }
  return notification;
}
