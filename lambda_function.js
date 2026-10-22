import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

// Don't set AWS_REGION yourself (reserved). Lambda already provides it.
// Optional override: set SES_REGION if SES is in another region.
const region =
  process.env.SES_REGION ||
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION;

const ses = new SESClient({ region });

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const ALLOWED_ORIGIN = process.env.ALLOW_ORIGIN || "*";
const TO_EMAIL = process.env.TO_EMAIL;
const FROM_EMAIL = process.env.FROM_EMAIL;

// In-memory rate limiting. A Lambda container is not shared across every
// concurrent invocation, so this is a soft limit that raises the cost of a
// casual flood rather than a hard guarantee. Put CloudFront or API Gateway
// throttling in front if you need a hard one.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 3;
const seen = new Map();

const LIMITS = {
  name: { min: 1, max: 120 },
  email: { min: 5, max: 200 },
  message: { min: 10, max: 5000 },
  website: { max: 200 }, // honeypot: must be empty
};

// Very small guard against the cheapest form of spam.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_RE = /(https?:\/\/|www\.)/i;

const headers = (extra = {}) => ({
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin",
  // Contact messages are personal data; keep them out of shared caches.
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  ...extra,
});

const response = (statusCode, body, extra) => ({
  statusCode,
  headers: headers(extra),
  body: JSON.stringify(body),
});

const clientIp = (event) =>
  event?.requestContext?.http?.sourceIp ||
  event?.requestContext?.identity?.sourceIp ||
  event?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
  "unknown";

function rateLimited(ip) {
  const now = Date.now();
  for (const [key, stamp] of seen) {
    if (now - stamp > WINDOW_MS) seen.delete(key);
  }
  const hits = (seen.get(ip) || 0) + 1;
  seen.set(ip, hits);
  return hits > MAX_PER_WINDOW;
}

const clean = (v) => (typeof v === "string" ? v.replace(/\0/g, "").trim() : "");

function validate(body) {
  const name = clean(body.name);
  const email = clean(body.email);
  const message = clean(body.message);
  const website = clean(body.website);

  if (website) return { ok: false, error: "Rejected" };

  if (name.length < LIMITS.name.min || name.length > LIMITS.name.max)
    return { ok: false, error: "Please give a name between 1 and 120 characters" };
  if (!EMAIL_RE.test(email) || email.length > LIMITS.email.max)
    return { ok: false, error: "That email address does not look right" };
  if (message.length < LIMITS.message.min || message.length > LIMITS.message.max)
    return { ok: false, error: "Message must be between 10 and 5,000 characters" };

  // Everything the front end already checks, repeated here because the client
  // is not a trust boundary.
  const links = (message.match(new RegExp(URL_RE.source, "gi")) || []).length;
  if (links > 4) return { ok: false, error: "Message contains too many links" };

  return { ok: true, value: { name, email, message } };
}

export const handler = async (event) => {
  const method =
    event?.requestContext?.http?.method ||
    event?.requestContext?.httpMethod ||
    event?.httpMethod;

  if (method === "OPTIONS") return response(204, null);

  if (method !== "POST")
    return response(405, { ok: false, error: "Method not allowed" }, { Allow: "POST, OPTIONS" });

  const ip = clientIp(event);
  if (rateLimited(ip))
    return response(429, { ok: false, error: "Too many messages. Please try again shortly." });

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return response(400, { ok: false, error: "Invalid JSON" });
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return response(400, { ok: false, error: "Invalid request" });

  const check = validate(body);
  if (!check.ok) return response(400, { ok: false, error: check.error });

  if (!region)
    return response(500, { ok: false, error: "Server misconfiguration: region not set" });
  if (!TO_EMAIL || !FROM_EMAIL)
    return response(500, { ok: false, error: "Server misconfiguration: mail routing not set" });

  const { name, email, message } = check.value;
  const subject = `Portfolio contact from ${name}`;
  const text = `From: ${name} <${email}>\n\n${message}`;

  try {
    await ses.send(
      new SendEmailCommand({
        Source: FROM_EMAIL, // verified in SES
        Destination: { ToAddresses: [TO_EMAIL] },
        ReplyToAddresses: [email],
        Message: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: { Text: { Data: text, Charset: "UTF-8" } },
        },
      })
    );

    return response(200, { ok: true });
  } catch (err) {
    console.error("SES send failed:", err?.name || err);
    // Never leak provider detail back to the caller.
    return response(500, { ok: false, error: "Failed to send message" });
  }
};