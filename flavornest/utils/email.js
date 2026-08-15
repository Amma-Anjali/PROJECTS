const nodemailer = require('nodemailer');

/**
 * Email service
 * ─────────────
 * If SMTP_HOST isn't set, every email is "sent" in mock mode: logged to the
 * console (and returned to the caller) instead of dispatched. This means
 * registration, order confirmation, and password reset all work end-to-end
 * with zero email provider setup - configure real SMTP later without
 * touching any calling code.
 */

const useMock = !process.env.SMTP_HOST;

let transporter = null;
if (!useMock) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendMail({ to, subject, html }) {
  if (useMock) {
    console.log('\n📧 [mock email] ─────────────────────────');
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    console.log('──────────────────────────────────────────\n');
    return { mock: true, to, subject };
  }

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || 'FlavorNest <no-reply@flavornest.com>',
    to,
    subject,
    html,
  });
}

function wrapper(title, bodyHtml) {
  return `
    <div style="font-family:sans-serif; max-width:520px; margin:0 auto; color:#1a1007;">
      <h2 style="color:#d4460f;">🍜 FlavorNest</h2>
      <h3>${title}</h3>
      ${bodyHtml}
      <p style="margin-top:24px; font-size:12px; color:#888;">You're receiving this because you have a FlavorNest account.</p>
    </div>`;
}

function sendWelcomeEmail(user) {
  return sendMail({
    to: user.email,
    subject: 'Welcome to FlavorNest 🍜',
    html: wrapper(
      `Welcome, ${user.name}!`,
      `<p>Your account is ready. Explore recipes, plan your week, and get recipe kits delivered.</p>`
    ),
  });
}

function sendOrderConfirmationEmail(user, order) {
  const itemsHtml = order.items
    .map((i) => `<li>${i.quantity} × ${i.title} — $${(i.price * i.quantity).toFixed(2)}</li>`)
    .join('');
  return sendMail({
    to: user.email,
    subject: `Order Confirmed — #${String(order._id).slice(-8).toUpperCase()}`,
    html: wrapper(
      'Your order is confirmed!',
      `<ul>${itemsHtml}</ul><p><strong>Total: $${order.total.toFixed(2)}</strong></p><p>Track it anytime from "My Orders".</p>`
    ),
  });
}

function sendOrderStatusEmail(user, order) {
  const labels = { preparing: 'being prepared', out_for_delivery: 'out for delivery', delivered: 'delivered', cancelled: 'cancelled' };
  return sendMail({
    to: user.email,
    subject: `Order Update — #${String(order._id).slice(-8).toUpperCase()} is ${order.status.replace(/_/g, ' ')}`,
    html: wrapper('Order status update', `<p>Your order is now <strong>${labels[order.status] || order.status}</strong>.</p>`),
  });
}

function sendPasswordResetEmail(user, resetUrl) {
  return sendMail({
    to: user.email,
    subject: 'Reset your FlavorNest password',
    html: wrapper(
      'Password reset requested',
      `<p>Click below to set a new password. This link expires in 30 minutes.</p>
       <p><a href="${resetUrl}" style="background:#d4a24c;color:#1a1007;padding:10px 18px;border-radius:6px;text-decoration:none;">Reset Password</a></p>
       <p>If you didn't request this, you can safely ignore this email.</p>`
    ),
  });
}

module.exports = {
  useMock,
  sendMail,
  sendWelcomeEmail,
  sendOrderConfirmationEmail,
  sendOrderStatusEmail,
  sendPasswordResetEmail,
};
