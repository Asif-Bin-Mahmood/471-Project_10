const { sendJson } = require("../utils/http");

async function handle({ req, res, url, store }) {
  if ((url.pathname === "/api/listings" || url.pathname === "/api/listings/search") && req.method === "GET") {
    sendJson(res, 200, {
      week: "week-03",
      feature: "search-sorting-pagination-location-metrics",
      ...store.getListings(url.searchParams)
    });
    return true;
  }

  if (url.pathname === "/api/member4/listings/search" && req.method === "GET") {
    sendJson(res, 200, {
      week: "week-03",
      feature: "search-sorting-pagination-location-metrics",
      endpointPurpose: "Search listings with area filter, sorting, pagination, and calculated location metrics.",
      ...store.getListings(url.searchParams)
    });
    return true;
  }

  const metricMatch =
    url.pathname.match(/^\/api\/listings\/([^/]+)\/location-metric$/) ||
    url.pathname.match(/^\/api\/member4\/listings\/([^/]+)\/location-metric$/);
  if (metricMatch && req.method === "GET") {
    const listing = store.getListingById(metricMatch[1]);
    if (!listing) {
      sendJson(res, 404, { error: "Listing not found." });
      return true;
    }
    sendJson(res, 200, {
      week: "week-03",
      feature: "search-sorting-pagination-location-metrics",
      endpointPurpose: "Show the calculated nearest-landmark distance for one listing.",
      listingId: listing.id,
      title: listing.title,
      coordinates: {
        lat: listing.lat,
        lng: listing.lng
      },
      distanceKm: listing.distanceKm,
      metricLabel: listing.metricLabel
    });
    return true;
  }

  if ((url.pathname === "/api/listings/preferred-search" || url.pathname === "/api/member4/listings/preferred-search") && req.method === "GET") {
    const profile = store.getProfile();
    const params = new URLSearchParams({
      area: profile.preferredArea,
      maxPrice: String(profile.budgetMax),
      minSize: String(profile.minSize),
      sort: url.searchParams.get("sort") || "distance",
      page: url.searchParams.get("page") || "1",
      pageSize: url.searchParams.get("pageSize") || "3"
    });
    sendJson(res, 200, {
      week: "week-03",
      feature: "search-sorting-pagination-location-metrics",
      endpointPurpose: "Run search using saved business-owner preferences.",
      profileUsed: {
        preferredArea: profile.preferredArea,
        budgetMax: profile.budgetMax,
        minSize: profile.minSize
      },
      ...store.getListings(params)
    });
    return true;
  }

  return false;
}

module.exports = {
  handle
};
