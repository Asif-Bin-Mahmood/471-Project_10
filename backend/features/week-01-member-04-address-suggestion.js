const { readRequestBody, sendJson } = require("../utils/http");

async function handle({ req, res, url, store }) {
  if (url.pathname === "/api/address-suggestions" && req.method === "GET") {
    const query = url.searchParams.get("q") || "";
    sendJson(res, 200, {
      week: "week-01",
      feature: "member-04-address-suggestion",
      query,
      suggestions: store.listAddressSuggestions(query)
    });
    return true;
  }

  if (url.pathname === "/api/listings" && req.method === "POST") {
    try {
      const body = await readRequestBody(req);
      const listing = store.createListing(body);
      sendJson(res, 201, {
        week: "week-01",
        feature: "member-04-address-suggestion",
        listing
      });
    } catch (error) {
      sendJson(res, error.status || 500, { error: error.message });
    }
    return true;
  }

  return false;
}

module.exports = {
  handle
};
