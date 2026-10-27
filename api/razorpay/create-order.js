import crypto from "node:crypto";

const PACKS = {
  starter: { coins: 999, amount: 9900, label: "Starter" },
  creator: { coins: 2699, amount: 24900, label: "Creator" },
  pro_creator: { coins: 5499, amount: 49900, label: "Pro Creator" },
  studio: { coins: 11999, amount: 99900, label: "Studio" },
  studio_plus: { coins: 24999, amount: 199900, label: "Studio Plus" }
};
const json = (res, status, body) => res.status(status).json(body);
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return json(res, 401, { error: "Please sign in before buying coins." });
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const keyId = process.env.RAZORPAY_KEY_ID || process.env.LIVE_API_KEY;
  const keySecret = process.env.RAZORPAY_KEY_SECRET || process.env.LIVE_SECRET;
  if (!supabaseUrl || !anonKey || !serviceKey || !keyId || !keySecret)
    return json(res, 503, { error: "Payment service is not fully configured on the server." });
  try {
    const who = await fetch(supabaseUrl.replace(/\/$/, "") + "/auth/v1/user", {
      headers: { apikey: anonKey, Authorization: "Bearer " + token }
    });
    if (!who.ok) return json(res, 401, { error: "Session expired. Please sign in again." });
    const user = await who.json();
    const pack = PACKS[String(req.body?.packCode || "")];
    if (!pack) return json(res, 400, { error: "Choose a valid coin pack." });
    const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: "Basic " + Buffer.from(keyId + ":" + keySecret).toString("base64"), "Content-Type": "application/json" },
      body: JSON.stringify({ amount: pack.amount, currency: "INR", receipt: "maira_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24), notes: { user_id: user.id, pack_code: req.body.packCode, coins: String(pack.coins) } })
    });
    const order = await orderResponse.json();
    if (!orderResponse.ok || !order.id) {
      console.error("Razorpay order creation failed", orderResponse.status, order.error?.code || "");
      return json(res, 502, { error: "Could not create payment order. Please try again." });
    }
    const insert = await fetch(supabaseUrl.replace(/\/$/, "") + "/rest/v1/coin_purchases", {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: user.id, razorpay_order_id: order.id, pack_code: req.body.packCode, currency: "INR", amount_paise: pack.amount, coins: pack.coins, status: "created" })
    });
    if (!insert.ok) {
      console.error("Coin purchase record failed", insert.status, (await insert.text()).slice(0, 250));
      return json(res, 502, { error: "Could not prepare your payment securely. Please try again." });
    }
    return json(res, 200, { keyId, orderId: order.id, amount: pack.amount, currency: "INR", coins: pack.coins, name: "MAIRA AI Voice Agent", description: pack.label + " coin pack" });
  } catch (error) {
    console.error("Create order failed", error);
    return json(res, 502, { error: "Payment service is temporarily unavailable." });
  }
}
