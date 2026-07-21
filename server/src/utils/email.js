import { ApiError } from "./errors.js";

let nodemailerModule;
let testSender;

function selectedProvider() {
  const configured = String(process.env.EMAIL_PROVIDER || "").trim().toLowerCase();
  if (configured) return configured;
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SMTP_HOST) return "smtp";
  return "none";
}

function senderAddress() {
  if (process.env.EMAIL_FROM_ADDRESS) {
    return `${process.env.EMAIL_FROM_NAME || "SocialHub Market"} <${process.env.EMAIL_FROM_ADDRESS}>`;
  }
  return process.env.EMAIL_FROM || "SocialHub Market <no-reply@socialhubmarket.com>";
}

async function getSmtpTransport() {
  if (!process.env.SMTP_HOST) return null;
  if (!nodemailerModule) nodemailerModule = await import("nodemailer").catch(() => null);
  if (!nodemailerModule) return null;
  return nodemailerModule.default.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

function brandedCodeEmail({ heading, intro, code }) {
  const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || "";
  const text = `${heading}\n\n${intro}\n\nVerification code: ${code}\n\nThis code expires in 10 minutes. Do not share it with anyone. If you did not request this, ignore this email.${frontendUrl ? `\n\nOpen SocialHub Market: ${frontendUrl}` : ""}`;
  const html = `<!doctype html>
<html><body style="margin:0;background:#f3faf7;font-family:Arial,sans-serif;color:#102a43">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;background:#f3faf7"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #d9eee5;border-radius:20px;overflow:hidden">
      <tr><td style="padding:24px;background:#087f5b;color:#ffffff;font-size:22px;font-weight:800">SocialHub Market</td></tr>
      <tr><td style="padding:28px">
        <h1 style="margin:0 0 12px;font-size:24px">${heading}</h1>
        <p style="margin:0 0 22px;line-height:1.6;color:#52606d">${intro}</p>
        <div style="padding:18px;border-radius:14px;background:#ecfdf5;text-align:center;font-size:34px;font-weight:800;letter-spacing:10px;color:#087f5b">${code}</div>
        <p style="margin:22px 0 8px;line-height:1.6;color:#52606d">This code expires in <strong>10 minutes</strong>.</p>
        <p style="margin:0;line-height:1.6;color:#b42318"><strong>Do not share this code with anyone.</strong></p>
        <p style="margin:18px 0 0;line-height:1.6;color:#7b8794">If you did not request this, you can safely ignore this email.</p>
        ${frontendUrl ? `<p style="margin:18px 0 0"><a href="${frontendUrl}" style="color:#087f5b;font-weight:700">Open SocialHub Market</a></p>` : ""}
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  return { text, html };
}

export const emailTemplates = {
  verifyEmail: ({ code }) => ({
    subject: "Verify your SocialHub account",
    ...brandedCodeEmail({
      heading: "Verify your email address",
      intro: "Enter this code in SocialHub Market to finish creating your account.",
      code,
    }),
  }),
  passwordResetCode: ({ code }) => ({
    subject: "Reset your SocialHub password",
    ...brandedCodeEmail({
      heading: "Reset your password",
      intro: "Enter this code in SocialHub Market to choose a new password.",
      code,
    }),
  }),
  welcome: ({ name }) => ({
    subject: "Welcome to SocialHub Market",
    text: `Hi ${name}, welcome to SocialHub Market.`,
  }),
  depositPending: ({ amount }) => ({ subject: "Deposit submitted", text: `Your deposit request for NGN ${amount} is pending review.` }),
  depositApproved: ({ amount }) => ({ subject: "Deposit approved", text: `Your deposit for NGN ${amount} has been approved and credited.` }),
  depositRejected: () => ({ subject: "Deposit rejected", text: "Your deposit was rejected. Please check your proof and submit again." }),
  orderConfirmation: ({ orderNumber, downloadUrl }) => ({ subject: "Order created", text: `Your order ${orderNumber} is complete.${downloadUrl ? ` Download from your dashboard: ${downloadUrl}` : ""}` }),
  orderCompleted: ({ orderNumber }) => ({ subject: "Order completed", text: `Your order ${orderNumber} has been completed.` }),
};

export function emailDeliveryIsConfigured() {
  if (testSender && process.env.NODE_ENV === "test") return true;
  const provider = selectedProvider();
  if (provider === "resend") return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM_ADDRESS);
  if (provider === "smtp") return Boolean(process.env.SMTP_HOST);
  return false;
}

export function setEmailSenderForTests(sender) {
  if (process.env.NODE_ENV !== "test") throw new Error("Test email sender is only available in test mode.");
  testSender = sender;
}

export async function sendEmail(to, templateName, params = {}, options = {}) {
  const template = emailTemplates[templateName]?.(params);
  if (!to || !template) return { skipped: true };
  if (testSender && process.env.NODE_ENV === "test") return testSender({ to, templateName, params, template });

  if (!emailDeliveryIsConfigured()) {
    if (options.required) throw new ApiError(503, "Email delivery is temporarily unavailable.");
    return { skipped: true };
  }

  try {
    if (selectedProvider() === "resend") {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: senderAddress(),
          to: [to],
          subject: template.subject,
          text: template.text,
          html: template.html,
        }),
      });
      if (!response.ok) throw new Error(`Resend request failed with status ${response.status}.`);
      return { sent: true };
    }

    const transport = await getSmtpTransport();
    if (!transport) throw new Error("SMTP transport is unavailable.");
    await transport.sendMail({ from: senderAddress(), to, ...template });
    return { sent: true };
  } catch (error) {
    console.error("Email delivery failed.", { provider: selectedProvider(), message: error.message });
    if (options.required) throw new ApiError(503, "Email delivery is temporarily unavailable.");
    return { failed: true };
  }
}
