import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

// Don't set AWS_REGION yourself (reserved). Lambda already provides it.
// Optional override: set SES_REGION if SES is in another region.
const region =
  process.env.SES_REGION ||
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION;

const ses = new SESClient({ region });

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    // IMPORTANT: set to your real domain in production
    "Access-Control-Allow-Origin": process.env.ALLOW_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  // API Gateway HTTP API (v2) preflight
  const method =
    event?.requestContext?.http?.method ||
    event?.requestContext?.httpMethod ||
    event?.httpMethod;

  if (method === "OPTIONS") return response(200, { ok: true });

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return response(400, { ok: false, error: "Invalid JSON" });
  }

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const message = String(body.message || "").trim();

  if (!name || !email || !message) {
    return response(400, {
      ok: false,
      error: "name, email, message are required",
    });
  }
  if (message.length > 5000) {
    return response(400, { ok: false, error: "Message too long" });
  }

  if (!region) {
    // Extremely rare, but makes failures obvious if region isn't available
    return response(500, {
      ok: false,
      error: "Server misconfiguration: region not set",
    });
  }

  const subject = `Portfolio contact from ${name}`;
  const text = `From: ${name} <${email}>\n\n${message}`;

  try {
    await ses.send(
      new SendEmailCommand({
        Source: process.env.FROM_EMAIL, // verified in SES (domain identity covers any address on the domain)
        Destination: { ToAddresses: [process.env.TO_EMAIL] }, // your inbox
        ReplyToAddresses: [email],
        Message: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: { Text: { Data: text, Charset: "UTF-8" } },
        },
      })
    );

    return response(200, { ok: true });
  } catch (err) {
    console.error("SES send failed:", err);
    return response(500, { ok: false, error: "Failed to send message" });
  }
};