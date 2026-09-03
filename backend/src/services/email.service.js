import nodemailer from "nodemailer";

// Render blocks outbound SMTP on both 465 and 587, so Gmail cannot be reached
// from the deployed host at all. When BREVO_API_KEY is present the same
// messages are delivered over HTTPS instead, which no host blocks. Without
// that key nothing changes and SMTP is used exactly as before.
const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";
const BREVO_ACCOUNT_URL = "https://api.brevo.com/v3/account";
const HTTP_TIMEOUT_MS = 12000;

function brevoApiKey() {
  return String(process.env.BREVO_API_KEY || "").trim();
}

async function brevoRequest(url, { method = "GET", body } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "api-key": brevoApiKey(),
        ...(body ? { "content-type": "application/json" } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.message || `Brevo request failed with status ${response.status}.`);
      error.code = response.status === 401 ? "EAUTH" : "EBREVO";
      error.responseCode = response.status;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("Brevo request timed out.");
      timeoutError.code = "ETIMEDOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// Some hosts (Render's free instances among them) block outbound SMTPS on 465
// while still permitting submission on 587, so try both before giving up.
const SMTP_CANDIDATES = [
  { host: "smtp.gmail.com", port: 465, secure: true },
  { host: "smtp.gmail.com", port: 587, secure: false, requireTLS: true }
];

// When no port is reachable, remember that briefly. Without this every booking,
// message and review would sit through a fresh connection timeout on each send.
const FAILURE_BACKOFF_MS = 5 * 60 * 1000;

let transporter;
let transportPort = 0;
let lastFailure;
let failureUntil = 0;

function emailConfiguration() {
  const user = String(process.env.EMAIL_USER || "").trim();
  // Google displays app passwords in four spaced groups ("abcd efgh ijkl mnop").
  // Gmail's SMTP AUTH rejects the spaced form, so strip all whitespace rather
  // than only trimming the ends.
  const pass = String(process.env.EMAIL_PASS || "").replace(/\s+/g, "");
  if (!user || !pass) {
    const error = new Error("Email delivery is not configured. EMAIL_USER and EMAIL_PASS are required.");
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }
  return { user, pass };
}

function buildTransport(candidate, auth) {
  return nodemailer.createTransport({
    ...candidate,
    auth,
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
}

async function resolveTransport() {
  if (transporter) return transporter;

  const auth = emailConfiguration();

  if (lastFailure && Date.now() < failureUntil) throw lastFailure;

  let failure;
  for (const candidate of SMTP_CANDIDATES) {
    const candidateTransport = buildTransport(candidate, auth);
    try {
      await candidateTransport.verify();
      transporter = candidateTransport;
      transportPort = candidate.port;
      lastFailure = undefined;
      failureUntil = 0;
      console.log(`[email] SMTP ready on ${candidate.host}:${candidate.port}`);
      return transporter;
    } catch (error) {
      failure = error;
      candidateTransport.close();
      console.error(`[email] ${candidate.host}:${candidate.port} unavailable (${error.code || error.message})`);
    }
  }

  lastFailure = failure;
  failureUntil = Date.now() + FAILURE_BACKOFF_MS;
  throw failure;
}

function maskedEmail(address) {
  const [local = "", domain = ""] = String(address || "").split("@");
  if (!domain) return "invalid-recipient";
  return `${local.slice(0, 1)}***@${domain}`;
}

export async function verifyEmailTransport() {
  if (brevoApiKey()) {
    const account = await brevoRequest(BREVO_ACCOUNT_URL);
    return { provider: "brevo", account: account?.email ? maskedEmail(account.email) : undefined };
  }
  await resolveTransport();
  return { provider: "smtp", port: transportPort };
}

export async function sendEmail({ to, subject, text, html, event = "notification" }) {
  const recipient = String(to || "").trim();
  if (!recipient) {
    const error = new Error("Email recipient is required.");
    error.code = "EMAIL_RECIPIENT_REQUIRED";
    throw error;
  }

  const senderAddress = String(process.env.EMAIL_USER || "").trim();

  if (brevoApiKey()) {
    if (!senderAddress) {
      const error = new Error("EMAIL_USER is required as the verified Brevo sender address.");
      error.code = "EMAIL_NOT_CONFIGURED";
      throw error;
    }
    const result = await brevoRequest(BREVO_SEND_URL, {
      method: "POST",
      body: {
        sender: { name: "OfficeKhoj BD", email: senderAddress },
        replyTo: { email: senderAddress },
        to: [{ email: recipient }],
        subject,
        textContent: text,
        htmlContent: html,
        headers: { "X-OfficeKhoj-Event": event }
      }
    });
    console.log(`[email] ${event} sent to ${maskedEmail(recipient)} via brevo (${result?.messageId || "queued"})`);
    return result;
  }

  const { user } = emailConfiguration();
  const active = await resolveTransport();
  const info = await active.sendMail({
    from: `"OfficeKhoj BD" <${user}>`,
    to: recipient,
    replyTo: user,
    subject,
    text,
    html,
    headers: { "X-OfficeKhoj-Event": event }
  });

  console.log(`[email] ${event} sent to ${maskedEmail(recipient)} via port ${transportPort} (${info.messageId})`);
  return info;
}

export async function closeEmailTransport() {
  if (transporter) {
    transporter.close();
    transporter = undefined;
    transportPort = 0;
  }
  lastFailure = undefined;
  failureUntil = 0;
}
