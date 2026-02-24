import Stripe from "stripe";

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.includes("placeholder")) {
    throw new Error("Stripe is not configured");
  }
  stripeClient = new Stripe(key, {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
  });
  return stripeClient;
}

export async function createOrRetrieveCustomer(
  email: string,
  name?: string | null
): Promise<string> {
  const stripe = getStripe();
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data.length > 0) return existing.data[0].id;

  const customer = await stripe.customers.create({ email, name: name ?? undefined });
  return customer.id;
}

export async function createCheckoutSession(
  customerId: string,
  stripePriceIds: string[],
  successUrl: string,
  cancelUrl: string,
  metadata?: Record<string, string>
): Promise<string> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: stripePriceIds.map((price) => ({ price, quantity: 1 })),
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    subscription_data: { metadata },
  });
  return session.url!;
}

export async function createProductAndPrice(
  name: string,
  priceMonthly: number
): Promise<string> {
  const stripe = getStripe();
  const product = await stripe.products.create({ name });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: Math.round(priceMonthly * 100),
    currency: "eur",
    recurring: { interval: "month" },
  });
  return price.id;
}

export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}
