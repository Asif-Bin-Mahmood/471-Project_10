import mongoose from "mongoose";
import { verifyEmailTransport } from "../services/email.service.js";

// Reports only whether credentials are present, never their values, so the
// deployed environment can be diagnosed without exposing secrets.
function configured(...names) {
  return names.every((name) => String(process.env[name] || "").trim().length > 0);
}

// A live SMTP handshake is comparatively expensive and talks to Gmail, so the
// result is cached and only produced when explicitly requested.
const SMTP_CACHE_MS = 60 * 1000;
let smtpCheck = { checkedAt: 0, result: null };

// Surfaces the failure reason without echoing the address or app password.
function describeSmtpError(error) {
  const code = String(error?.code || "");
  const responseCode = Number(error?.responseCode) || undefined;
  let reason = "SMTP verification failed.";
  if (code === "EMAIL_NOT_CONFIGURED") reason = "EMAIL_USER and EMAIL_PASS are not set.";
  else if (responseCode === 535 || code === "EAUTH") reason = "Gmail rejected the credentials. Check the App Password.";
  else if (code === "EDNS") reason = "Could not resolve smtp.gmail.com from this host.";
  else if (code === "ETIMEDOUT" || code === "ESOCKET" || code === "ECONNECTION") {
    reason = "Neither smtp.gmail.com:465 nor :587 could be reached. This host blocks outbound SMTP.";
  }
  return { ok: false, code: code || "UNKNOWN", responseCode, reason };
}

async function checkSmtp() {
  if (smtpCheck.result && Date.now() - smtpCheck.checkedAt < SMTP_CACHE_MS) {
    return { ...smtpCheck.result, cached: true };
  }
  let result;
  try {
    const { port } = await verifyEmailTransport();
    result = { ok: true, port, reason: `Gmail accepted the credentials on port ${port}.` };
  } catch (error) {
    result = describeSmtpError(error);
  }
  smtpCheck = { checkedAt: Date.now(), result };
  return result;
}

export async function getHealth(req, res) {
  const payload = {
    ok: true,
    app: "OfficeKhoj BD MERN API",
    stack: ["MongoDB", "Express", "React", "Node"],
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    integrations: {
      database: mongoose.connection.readyState === 1,
      email: configured("EMAIL_USER", "EMAIL_PASS"),
      cloudinary: configured("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"),
      foursquare: configured("FOURSQUARE_BEARER_TOKEN"),
      nominatim: true
    }
  };

  if (String(req.query.check || "") === "email") {
    payload.emailTransport = await checkSmtp();
  }

  res.json(payload);
}
