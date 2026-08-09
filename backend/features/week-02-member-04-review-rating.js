const { readRequestBody, sendJson } = require("../utils/http");

async function handle({ req, res, url, store }) {
  if (url.pathname === "/api/reviews" && req.method === "GET") {
    sendJson(res, 200, {
      week: "week-02",
      feature: "review-rating",
      reviews: store.getReviews(url.searchParams.get("listingId"))
    });
    return true;
  }

  const reviewsMatch =
    url.pathname.match(/^\/api\/reviews\/([^/]+)$/) ||
    url.pathname.match(/^\/api\/member4\/reviews\/([^/]+)$/);
  if (reviewsMatch && req.method === "GET") {
    const listingId = reviewsMatch[1];
    sendJson(res, 200, {
      week: "week-02",
      feature: "review-rating",
      endpointPurpose: "Get all reviews for a specific property or service listing.",
      listingId,
      reviews: store.getReviews(listingId)
    });
    return true;
  }

  const summaryMatch =
    url.pathname.match(/^\/api\/reviews\/([^/]+)\/summary$/) ||
    url.pathname.match(/^\/api\/member4\/reviews\/([^/]+)\/summary$/);
  if (summaryMatch && req.method === "GET") {
    const listingId = summaryMatch[1];
    const listing = store.getListingById(listingId);
    if (!listing) {
      sendJson(res, 404, { error: "Listing not found." });
      return true;
    }
    sendJson(res, 200, {
      week: "week-02",
      feature: "review-rating",
      endpointPurpose: "Get average rating and review count summary for a listing.",
      listingId,
      averageRating: listing.rating,
      reviewCount: listing.reviewCount,
      latestReviews: listing.reviews
    });
    return true;
  }

  if (url.pathname === "/api/reviews" && req.method === "POST") {
    try {
      const body = await readRequestBody(req);
      sendJson(res, 201, {
        week: "week-02",
        feature: "review-rating",
        ...store.createReview(body)
      });
    } catch (error) {
      sendJson(res, error.status || 500, { error: error.message });
    }
    return true;
  }

  if (url.pathname === "/api/member4/reviews" && req.method === "POST") {
    try {
      const body = await readRequestBody(req);
      sendJson(res, 201, {
        week: "week-02",
        feature: "review-rating",
        endpointPurpose: "Create a new 1-5 star review and update average rating.",
        ...store.createReview(body)
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
