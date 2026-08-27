import { io } from "socket.io-client";
import { getAuthToken } from "../api/client.js";

const LOCAL_SOCKET_URL = "http://127.0.0.1:5000";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? LOCAL_SOCKET_URL : "");

let socket;

export function connectSocket() {
  const token = getAuthToken();
  if (!token) return null;

  if (!socket) {
    const options = {
      autoConnect: false,
      auth: { token },
      reconnection: true
    };
    socket = SOCKET_URL ? io(SOCKET_URL, options) : io(options);
  } else {
    socket.auth = { token };
  }

  if (!socket.connected) socket.connect();
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.io.removeAllListeners();
  socket.disconnect();
  socket = undefined;
}
