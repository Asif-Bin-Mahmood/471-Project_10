const { readRequestBody, sendJson } = require("../utils/http");

async function handle({ req, res, url, store }) {
  if (url.pathname === "/api/profile" && req.method === "GET") {
    sendJson(res, 200, {
      week: "week-03",
      feature: "member-04-business-profile",
      profile: store.getProfile()
    });
    return true;
  }

  if (url.pathname === "/api/profile" && req.method === "PUT") {
    const body = await readRequestBody(req);
    sendJson(res, 200, {
      week: "week-03",
      feature: "member-04-business-profile",
      profile: store.updateProfile(body)
    });
    return true;
  }

  return false;
}

module.exports = {
  handle
};
