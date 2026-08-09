const { sendJson } = require("../utils/http");

async function handle({ req, res, url, store }) {
  if (url.pathname === "/api/notifications" && req.method === "GET") {
    const userId = url.searchParams.get("userId") || store.getDefaultUserId();
    const type = url.searchParams.get("type") || "";
    sendJson(res, 200, { notifications: store.getNotifications(userId, type) });
    return true;
  }

  const readMatch = url.pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
  if (readMatch && req.method === "PUT") {
    try {
      sendJson(res, 200, { notification: store.markNotificationRead(readMatch[1]) });
    } catch (error) {
      sendJson(res, error.status || 500, { error: error.message });
    }
    return true;
  }

  if (url.pathname === "/api/email-logs" && req.method === "GET") {
    sendJson(res, 200, { emails: store.getEmailLogs() });
    return true;
  }

  return false;
}

module.exports = { handle };
