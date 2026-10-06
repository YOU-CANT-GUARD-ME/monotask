import { Resend } from "resend";
import { adminAuth, clientIp, rateLimit, sendError } from "./_lib/admin";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const cleanEmail = String(req.body?.email || "").trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      return res.status(400).json({ error: "Valid email is required" });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const resendFrom =
      process.env.RESEND_FROM || "Monotask <onboarding@resend.dev>";
    const appUrl =
      process.env.APP_PUBLIC_URL || "https://monotask-lock-in.vercel.app";

    if (!resendApiKey) {
      return res.status(500).json({ error: "RESEND_API_KEY is missing" });
    }

    // Stop this route being used to flood an inbox or spam many addresses.
    const hourMs = 60 * 60 * 1000;
    await rateLimit(`reset-ip:${clientIp(req)}`, 10, hourMs);
    await rateLimit(`reset-email:${cleanEmail}`, 3, hourMs);

    const auth = adminAuth();

    // Do not reveal whether the account exists.
    try {
      await auth.getUserByEmail(cleanEmail);
    } catch {
      return res.status(200).json({ ok: true });
    }

    const firebaseResetLink = await auth.generatePasswordResetLink(cleanEmail);
    const firebaseUrl = new URL(firebaseResetLink);
    const oobCode = firebaseUrl.searchParams.get("oobCode");

    if (!oobCode) {
      throw new Error("Could not create password reset code");
    }

    const resetUrl = `${appUrl}/reset-password?oobCode=${encodeURIComponent(
      oobCode
    )}&email=${encodeURIComponent(cleanEmail)}`;

    const safeEmail = escapeHtml(cleanEmail);

    const html = `
      <div style="margin:0;padding:0;background:#F4F1EA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#26221A;">
        <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
          <div style="background:#ffffff;border-radius:24px;padding:28px;border:1px solid rgba(106,122,82,0.16);">
            <div style="font-size:13px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:#87986A;margin-bottom:14px;">
              Monotask
            </div>

            <h1 style="font-size:24px;line-height:1.25;margin:0 0 12px;color:#26221A;">
              Reset your password
            </h1>

            <p style="font-size:15px;line-height:1.6;margin:0 0 18px;color:#5F654F;">
              We received a request to reset the password for this Monotask account:
            </p>

            <p style="font-size:14px;line-height:1.5;margin:0 0 24px;color:#26221A;font-weight:700;">
              ${safeEmail}
            </p>

            <a href="${resetUrl}"
              style="display:inline-block;background:#87986A;color:#F4F1EA;text-decoration:none;font-weight:800;font-size:15px;padding:14px 22px;border-radius:16px;">
              Reset Password
            </a>

            <p style="font-size:13px;line-height:1.6;margin:24px 0 0;color:#7B806F;">
              If you did not request this, you can safely ignore this email.
            </p>
          </div>

          <p style="font-size:12px;line-height:1.5;margin:18px 4px 0;color:#8A8D7B;">
            This link can only be used once and may expire.
          </p>
        </div>
      </div>
    `;

    const text = `Reset your Monotask password:

${resetUrl}

If you did not request this, you can ignore this email.`;

    const resend = new Resend(resendApiKey);

    const result = await resend.emails.send({
      from: resendFrom,
      to: cleanEmail,
      subject: "Reset your Monotask password",
      html,
      text,
    });

    if (result.error) {
      return res.status(500).json({ error: result.error });
    }

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    return sendError(res, error, "Password reset request failed");
  }
}
