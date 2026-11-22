import "server-only";

/**
 * Sends an email through Resend (https://resend.com) when RESEND_API_KEY is set.
 * Without a key (e.g. local development) the email is printed to the server log
 * instead, so links can still be tested.
 */
export async function sendEmail(msg: { to: string; subject: string; text: string; html: string }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Checkpoint <onboarding@resend.dev>";
  if (!key) {
    console.log(`[email not sent: RESEND_API_KEY is not set]\nTo: ${msg.to}\nSubject: ${msg.subject}\n\n${msg.text}\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    // Logged for the app owner; the person asking for a reset sees the usual message.
    console.error(`Email to ${msg.to} failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
}

/** Public address of the app, for links in emails. */
export function appUrl(requestHost?: string | null, proto?: string | null) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return `${proto ?? "http"}://${requestHost ?? "localhost:3000"}`;
}
