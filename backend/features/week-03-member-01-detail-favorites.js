const { sendJson } = require("../utils/http");

async function handle({ req, res, url, store }) {
  if (url.pathname === "/api/favorites" && req.method === "GET") {
    const userId = url.searchParams.get("userId") || store.getDefaultUserId();
    sendJson(res, 200, { favorites: store.getFavorites(userId) });
    return true;
  }

  const favoriteMatch = url.pathname.match(/^\/api\/listings\/([^/]+)\/favorite$/);
  if (favoriteMatch && (req.method === "POST" || req.method === "DELETE")) {
    const userId = url.searchParams.get("userId") || store.getDefaultUserId();
    try {
      sendJson(res, 200, store.toggleFavorite(favoriteMatch[1], userId, req.method === "POST"));
    } catch (error) {
      sendJson(res, error.status || 500, { error: error.message });
    }
    return true;
  }

  const detailMatch = url.pathname.match(/^\/api\/listings\/([^/]+)\/detail$/);
  if (detailMatch && req.method === "GET") {
    const listing = store.getListingById(detailMatch[1]);
    if (!listing) {
      sendJson(res, 404, { error: "Listing not found." });
      return true;
    }
    sendJson(res, 200, {
      listing,
      nearbyPlaces: store.getNearbyPlaces(detailMatch[1]),
      setupSuggestions: store.getSmartSetupSuggestions(detailMatch[1])
    });
    return true;
  }

  return false;
}

module.exports = { handle };
