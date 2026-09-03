import nodemailer from "nodemailer";

let transporter;

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

function getTransporter() {
  if (!transporter) {
    const auth = emailConfiguration();
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth,
      pool: true,
      maxConnections: 3,
      maxMessages: 50,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });
  }
  return transporter;
}

function maskedEmail(address) {
  const [local = "", domain = ""] = String(address || "").split("@");
  if (!domain) return "invalid-recipient";
  return `${local.slice(0, 1)}***@${domain}`;
}

export async function verifyEmailTransport() {
  return getTransporter().verify();
}

export async function sendEmail({ to, subject, text, html, event = "notification" }) {
  const recipient = String(to || "").trim();
  if (!recipient) {
    const error = new Error("Email recipient is required.");
    error.code = "EMAIL_RECIPIENT_REQUIRED";
    throw error;
  }

  const { user } = emailConfiguration();
  const info = await getTransporter().sendMail({
    from: `"OfficeKhoj BD" <${user}>`,
    to: recipient,
    replyTo: user,
    subject,
    text,
    html,
    headers: { "X-OfficeKhoj-Event": event }
  });

  console.log(`[email] ${event} sent to ${maskedEmail(recipient)} (${info.messageId})`);
  return info;
}

export async function closeEmailTransport() {
  if (transporter) {
    transporter.close();
    transporter = undefined;
  }
}
