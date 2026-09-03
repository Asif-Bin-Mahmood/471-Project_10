import mongoose from "mongoose";

// Reports only whether credentials are present, never their values, so the
// deployed environment can be diagnosed without exposing secrets.
function configured(...names) {
  return names.every((name) => String(process.env[name] || "").trim().length > 0);
}

export function getHealth(req, res) {
  res.json({
    ok: true,
    app: "OfficeKhoj BD MERN API",
    stack: ["MongoDB", "Express", "React", "Node"],
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    integrations: {
      database: mongoose.connection.readyState === 1,
      cloudinary: configured("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"),
      foursquare: configured("FOURSQUARE_BEARER_TOKEN"),
      nominatim: true,
      notifications: "in-app"
    }
  });
}
