export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const authorization = String(req.headers.authorization || "");
  if (!authorization.startsWith("Bearer ")) return res.status(401).json({ error: "Sign in to view voices assigned to your account." });
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(503).json({ error: "MAIRA database is not configured on the server." });
  try {
    const upstream = await fetch(supabaseUrl.replace(/\/$/, "") + "/rest/v1/voice_profiles?select=id,public_voice_id,name,language,profile_type,description,status,visibility,public_listing_consent,provider_voice_id&status=eq.active&provider_voice_id=not.is.null&order=created_at.desc", {
      headers: { apikey: supabaseKey, Authorization: authorization, Accept: "application/json" }
    });
    const rows = await upstream.json().catch(() => []);
    if (!upstream.ok) {
      console.error("MAIRA voice list database error", upstream.status);
      return res.status(upstream.status === 401 ? 401 : 502).json({ error: "Could not verify the voices assigned to this account." });
    }
    const voices = (Array.isArray(rows) ? rows : []).map(v => ({
      voice_id: v.provider_voice_id,
      name: v.name || "MAIRA Voice",
      category: v.profile_type || "Custom",
      labels: { language: v.language || "Multilingual", visibility: v.visibility || "private" },
      preview_url: null,
      maira_voice_id: v.public_voice_id
    }));
    return res.status(200).json({ voices });
  } catch (e) {
    console.error("MAIRA voice list request failed", e);
    return res.status(502).json({ error: "Unable to load your MAIRA voices." });
  }
}
