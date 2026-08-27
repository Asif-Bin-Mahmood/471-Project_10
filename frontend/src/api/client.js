const LOCAL_API_BASE = "http://127.0.0.1:5000/api";

export const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? LOCAL_API_BASE : "/api");
const TOKEN_KEY = "officekhoj_auth_token";

export function getAuthToken() {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export async function api(path, options = {}) {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    ...options
  });
  const data = await response.json();
  if (!response.ok) {
    const details = Array.isArray(data.details) ? ` ${data.details.join(" ")}` : "";
    throw new Error(`${data.error || `Request failed: ${response.status}`}${details}`);
  }
  return data;
}
