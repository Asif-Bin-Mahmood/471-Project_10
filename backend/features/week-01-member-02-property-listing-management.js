const { readRequestBody, sendJson } = require("../utils/http");

async function handle({ req, res, url, store }) {
  const listingMatch = url.pathname.match(/^\/api\/listings\/([^/]+)$/);
  if (!listingMatch) return false;

  const listingId = listingMatch[1];

  if (req.method === "GET") {
    const listing = store.getListingById(listingId);
    if (!listing) {
      sendJson(res, 404, { error: "Listing not found." });
      return true;
    }
    sendJson(res, 200, { listing });
    return true;
  }

  if (req.method === "PUT") {
    try {
      const body = await readRequestBody(req);
      sendJson(res, 200, { listing: store.updateListing(listingId, body) });
    } catch (error) {
      sendJson(res, error.status || 500, { error: error.message });
    }
    return true;
  }

  if (req.method === "DELETE") {
    try {
      sendJson(res, 200, { listing: store.deleteListing(listingId) });
    } catch (error) {
      sendJson(res, error.status || 500, { error: error.message });
    }
    return true;
  }

  return false;
}

module.exports = { handle };
