import crypto from "node:crypto";

export const config = { api: { bodyParser: false } };
async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !supabaseUrl || !serviceKey) return res.status(503).json({ error: "Webhook is not configured." });
  try {
    const raw = await rawBody(req);
    const signature = String(req.headers["x-razorpay-signature"] || "");
    const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    const a = Buffer.from(signature), b = Buffer.from(expected);
    if (!signature || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(400).json({ error: "Invalid signature." });
    const event = JSON.parse(raw.toString("utf8"));
    if (event.event !== "payment.captured") return res.status(200).json({ received: true, ignored: true });
    const payment = event.payload?.payment?.entity;
    const orderEntity = event.payload?.order?.entity;
    const orderId = payment?.order_id || orderEntity?.id;
    const paymentId = payment?.id || null;
    if (!orderId || !payment || payment.status !== "captured" || !payment.id) return res.status(200).json({ received: true, ignored: true });
    const base = supabaseUrl.replace(/\/$/, "") + "/rest/v1";
    const headers = { apikey: serviceKey, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json" };
    const find = await fetch(base + "/coin_purchases?select=id,user_id,coins,amount_paise,status&razorpay_order_id=eq." + encodeURIComponent(orderId) + "&limit=1", { headers });
    const rows = await find.json();
    if (!find.ok) throw new Error("Could not look up purchase");
    if (!rows.length) return res.status(200).json({ received: true, unmatched: true });
    const purchase = rows[0];
    if (purchase.status === "paid") return res.status(200).json({ received: true, duplicate: true });
    if (Number(payment.amount) !== Number(purchase.amount_paise) || payment.currency !== "INR" || payment.order_id !== orderId) return res.status(400).json({ error: "Payment amount/currency mismatch." });
    // The ledger reference is unique; duplicate webhook deliveries cannot credit coins twice.
    const ledger = await fetch(base + "/coin_ledger?select=id&reference=eq.purchase:" + encodeURIComponent(orderId) + "&limit=1", { headers });
    const existing = await ledger.json();
    if (!ledger.ok) throw new Error("Could not verify purchase ledger");
    if (!existing.length) {
      const credit = await fetch(base + "/rpc/credit_coin_purchase", {
        method: "POST", headers,
        body: JSON.stringify({ p_user_id: purchase.user_id, p_coins: purchase.coins, p_order_id: orderId, p_payment_id: paymentId })
      });
      if (!credit.ok) {
        console.error("Wallet credit RPC failed", credit.status, (await credit.text()).slice(0, 250));
        throw new Error("Wallet credit failed");
      }
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Razorpay webhook failed", error);
    return res.status(500).json({ error: "Webhook processing failed; provider may retry." });
  }
}
