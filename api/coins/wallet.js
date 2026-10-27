export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Please sign in." });
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return res.status(503).json({ error: "Wallet is not configured." });
  try {
    const who = await fetch(url.replace(/\/$/, "") + "/auth/v1/user", { headers: { apikey: anon, Authorization: "Bearer " + token } });
    if (!who.ok) return res.status(401).json({ error: "Session expired." });
    const user = await who.json();
    const response = await fetch(url.replace(/\/$/, "") + "/rest/v1/coin_wallets?select=balance&user_id=eq." + encodeURIComponent(user.id) + "&limit=1", {
      headers: { apikey: service, Authorization: "Bearer " + service }
    });
    const rows = await response.json();
    if (!response.ok) throw new Error("Wallet query failed");
    return res.status(200).json({ balance: rows[0]?.balance || 0 });
  } catch (error) {
    console.error("Wallet read failed", error);
    return res.status(502).json({ error: "Could not load wallet balance." });
  }
}
