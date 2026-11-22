import "server-only";

type Msg = { to: string; subject: string; text: string; html: string };

/** Splits "Name <addr@x.com>" into its parts. */
function parseFrom(from: string) {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1] || "Checkpoint", email: m[2] } : { name: "Checkpoint", email: from.trim() };
}

/**
 * Sends an email through whichever provider is configured:
 *  - Brevo (BREVO_API_KEY): can send from a single verified email address, no domain needed.
 *  - Resend (RESEND_API_KEY): needs a verified domain to email anyone but yourself.
 * With neither (e.g. local development) the email is printed to the server log instead.
 */
export async function sendEmail(msg: Msg) {
  const brevo = process.env.BREVO_API_KEY;
  const resend = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Checkpoint <onboarding@resend.dev>";

  if (!brevo && !resend) {
    console.log(`[email not sent: no email provider configured]\nTo: ${msg.to}\nSubject: ${msg.subject}\n\n${msg.text}\n`);
    return;
  }

  const res = brevo
    ? await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevo, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sender: parseFrom(from),
          to: [{ email: msg.to }],
          subject: msg.subject,
          textContent: msg.text,
          htmlContent: msg.html,
        }),
        signal: AbortSignal.timeout(10000),
      })
    : await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
        signal: AbortSignal.timeout(10000),
      });
  if (!res.ok) {
    // Logged for the app owner; the person asking for a reset sees the usual message.
    console.error(`Email to ${msg.to} failed (${brevo ? "Brevo" : "Resend"}): ${res.status} ${await res.text().catch(() => "")}`);
  }
}

/** Public address of the app, for links in emails. */
export function appUrl(requestHost?: string | null, proto?: string | null) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return `${proto ?? "http"}://${requestHost ?? "localhost:3000"}`;
}
