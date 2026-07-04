let nodemailerModule;

async function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  if (!nodemailerModule) {
    nodemailerModule = await import("nodemailer").catch(() => null);
  }
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

export const emailTemplates = {
  welcome: ({ name }) => ({
    subject: "Welcome to SocialHub Market",
    text: `Hi ${name}, welcome to SocialHub Market.`,
  }),
  depositPending: ({ amount }) => ({
    subject: "Deposit submitted",
    text: `Your deposit request for NGN ${amount} is pending review.`,
  }),
  depositApproved: ({ amount }) => ({
    subject: "Deposit approved",
    text: `Your deposit for NGN ${amount} has been approved and credited.`,
  }),
  depositRejected: () => ({
    subject: "Deposit rejected",
    text: "Your deposit was rejected. Please check your proof and submit again.",
  }),
  orderConfirmation: ({ orderNumber, downloadUrl }) => ({
    subject: "Order created",
    text: `Your order ${orderNumber} is complete.${downloadUrl ? ` Download from your dashboard: ${downloadUrl}` : ""}`,
  }),
  orderCompleted: ({ orderNumber }) => ({
    subject: "Order completed",
    text: `Your order ${orderNumber} has been completed.`,
  }),
  passwordReset: ({ resetUrl }) => ({
    subject: "Reset your SocialHub Market password",
    text: `Use this link to reset your password. It expires in 30 minutes: ${resetUrl}`,
  }),
};

export async function sendEmail(to, templateName, params = {}) {
  const template = emailTemplates[templateName]?.(params);
  if (!to || !template) return { skipped: true };
  const transport = await getTransport();
  if (!transport) {
    console.log(`[email skipped] ${template.subject} -> ${to}`);
    return { skipped: true };
  }
  return transport.sendMail({
    from: process.env.EMAIL_FROM || "SocialHub Market <no-reply@socialhub.test>",
    to,
    subject: template.subject,
    text: template.text,
  });
}
