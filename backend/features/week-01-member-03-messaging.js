const { readRequestBody, sendJson } = require("../utils/http");

async function handle({ req, res, url, store }) {
  if (url.pathname === "/api/conversations" && req.method === "GET") {
    const userId = url.searchParams.get("userId") || store.getDefaultUserId();
    sendJson(res, 200, { conversations: store.getConversations(userId) });
    return true;
  }

  if (url.pathname === "/api/conversations" && req.method === "POST") {
    try {
      const body = await readRequestBody(req);
      sendJson(res, 201, { conversation: store.createConversation(body) });
    } catch (error) {
      sendJson(res, error.status || 500, { error: error.message });
    }
    return true;
  }

  const messageListMatch = url.pathname.match(/^\/api\/messages\/([^/]+)$/);
  if (messageListMatch && req.method === "GET") {
    sendJson(res, 200, { messages: store.getMessages(messageListMatch[1]) });
    return true;
  }

  if (url.pathname === "/api/messages" && req.method === "POST") {
    try {
      const body = await readRequestBody(req);
      sendJson(res, 201, store.sendMessage(body));
    } catch (error) {
      sendJson(res, error.status || 500, { error: error.message });
    }
    return true;
  }

  return false;
}

module.exports = { handle };
