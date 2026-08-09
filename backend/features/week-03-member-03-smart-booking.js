const { readRequestBody, sendJson } = require("../utils/http");

async function handle({ req, res, url, store }) {
  const setupMatch = url.pathname.match(/^\/api\/listings\/([^/]+)\/setup-suggestions$/);
  if (setupMatch && req.method === "GET") {
    try {
      sendJson(res, 200, { suggestions: store.getSmartSetupSuggestions(setupMatch[1]) });
    } catch (error) {
      sendJson(res, error.status || 500, { error: error.message });
    }
    return true;
  }

  if (url.pathname === "/api/bookings" && req.method === "GET") {
    const userId = url.searchParams.get("userId") || store.getDefaultUserId();
    sendJson(res, 200, { bookings: store.getBookings(userId) });
    return true;
  }

  if (url.pathname === "/api/bookings" && req.method === "POST") {
    try {
      const body = await readRequestBody(req);
      sendJson(res, 201, { booking: store.createBooking(body) });
    } catch (error) {
      sendJson(res, error.status || 500, { error: error.message });
    }
    return true;
  }

  const respondMatch = url.pathname.match(/^\/api\/bookings\/([^/]+)\/respond$/);
  if (respondMatch && req.method === "PUT") {
    try {
      const body = await readRequestBody(req);
      sendJson(res, 200, { booking: store.respondBooking(respondMatch[1], body) });
    } catch (error) {
      sendJson(res, error.status || 500, { error: error.message });
    }
    return true;
  }

  return false;
}

module.exports = { handle };
