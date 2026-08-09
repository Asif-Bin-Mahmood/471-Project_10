const { readRequestBody, sendJson } = require("../utils/http");

async function handle({ req, res, url, store }) {
  const nearbyMatch = url.pathname.match(/^\/api\/listings\/([^/]+)\/nearby$/);
  if (nearbyMatch && req.method === "GET") {
    try {
      sendJson(res, 200, { nearbyPlaces: store.getNearbyPlaces(nearbyMatch[1]) });
    } catch (error) {
      sendJson(res, error.status || 500, { error: error.message });
    }
    return true;
  }

  const statusMatch = url.pathname.match(/^\/api\/listings\/([^/]+)\/status$/);
  if (statusMatch && req.method === "PUT") {
    try {
      const body = await readRequestBody(req);
      sendJson(res, 200, { listing: store.updateListingStatus(statusMatch[1], body.status || "Available") });
    } catch (error) {
      sendJson(res, error.status || 500, { error: error.message });
    }
    return true;
  }

  return false;
}

module.exports = { handle };
