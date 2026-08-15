/**
 * Payment helper
 * ──────────────
 * Wraps Stripe PaymentIntents. If STRIPE_SECRET_KEY is unset or still the
 * placeholder ("sk_test_mock"), everything runs in a local mock mode so the
 * full cart → checkout → order-tracking flow works out of the box without
 * a Stripe account. Drop in a real test key from the Stripe dashboard to
 * switch to live test-mode payments - no other code changes needed.
 */

const useMock = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_mock';

let stripe = null;
if (!useMock) {
  const Stripe = require('stripe');
  stripe = Stripe(process.env.STRIPE_SECRET_KEY);
}

/**
 * amount: in the smallest currency unit (cents for USD)
 */
async function createPaymentIntent({ amount, currency, metadata = {} }) {
  if (useMock) {
    const id = `mock_pi_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
    return { id, client_secret: `${id}_secret`, status: 'requires_confirmation', amount, currency, mock: true };
  }

  return stripe.paymentIntents.create({
    amount,
    currency,
    metadata,
    automatic_payment_methods: { enabled: true },
  });
}

async function retrievePaymentIntent(id) {
  if (useMock || String(id).startsWith('mock_pi_')) {
    return { id, status: 'succeeded', mock: true };
  }
  return stripe.paymentIntents.retrieve(id);
}

module.exports = { createPaymentIntent, retrievePaymentIntent, useMock, publishableKey: process.env.STRIPE_PUBLISHABLE_KEY };
