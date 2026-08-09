const { readRequestBody, sendJson } = require("../utils/http");

async function handle({ req, res, url, store }) {
  if (url.pathname === "/api/dashboard" && req.method === "GET") {
    sendJson(res, 200, store.getDashboard());
    return true;
  }

  if (url.pathname === "/api/auth/register" && req.method === "POST") {
    try {
      const body = await readRequestBody(req);
      sendJson(res, 201, store.registerUser(body));
    } catch (error) {
      sendJson(res, error.status || 500, { error: error.message });
    }
    return true;
  }

  if (url.pathname === "/api/auth/login" && req.method === "POST") {
    try {
      const body = await readRequestBody(req);
      sendJson(res, 200, store.loginUser(body));
    } catch (error) {
      sendJson(res, error.status || 500, { error: error.message });
    }
    return true;
  }

  if (url.pathname === "/api/auth/me" && req.method === "GET") {
    const userId = url.searchParams.get("userId") || store.getDefaultUserId();
    sendJson(res, 200, { user: store.getProfile(userId) });
    return true;
  }

  if (url.pathname === "/api/admin/verifications" && req.method === "GET") {
    sendJson(res, 200, store.getAdminQueue());
    return true;
  }

  const verifyMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/verify$/);
  if (verifyMatch && req.method === "PUT") {
    try {
      const body = await readRequestBody(req);
      sendJson(res, 200, { user: store.verifyUser(verifyMatch[1], body.status || "verified") });
    } catch (error) {
      sendJson(res, error.status || 500, { error: error.message });
    }
    return true;
  }

  const moderateMatch = url.pathname.match(/^\/api\/admin\/listings\/([^/]+)\/moderate$/);
  if (moderateMatch && req.method === "PUT") {
    try {
      const body = await readRequestBody(req);
      sendJson(res, 200, { listing: store.moderateListing(moderateMatch[1], body) });
    } catch (error) {
      sendJson(res, error.status || 500, { error: error.message });
    }
    return true;
  }

  return false;
}

module.exports = { handle };
