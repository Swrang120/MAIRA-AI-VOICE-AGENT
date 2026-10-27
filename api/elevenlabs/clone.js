export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const authorization = String(req.headers.authorization || "");
  if (!authorization.startsWith("Bearer ")) return res.status(401).json({ error: "Admin sign-in is required to create voice clones." });
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(503).json({ error: "MAIRA database is not configured on the server." });
  try {
    const baseUrl = supabaseUrl.replace(/\/$/, "");
    const identityResponse = await fetch(baseUrl + "/auth/v1/user", {
      headers: { apikey: supabaseKey, Authorization: authorization, Accept: "application/json" }
    });
    const identity = await identityResponse.json().catch(() => ({}));
    if (!identityResponse.ok || !identity.id) return res.status(401).json({ error: "Sign in again to verify administrator access." });
    const roleCheck = await fetch(baseUrl + "/rest/v1/profiles?select=role&id=eq." + encodeURIComponent(identity.id) + "&limit=1", {
      headers: { apikey: supabaseKey, Authorization: authorization, Accept: "application/json" }
    });
    const roles = await roleCheck.json().catch(() => []);
    if (!roleCheck.ok || !Array.isArray(roles) || roles[0]?.role !== "admin") {
      return res.status(403).json({ error: "Only an authorized MAIRA administrator can create voice clones." });
    }
  } catch (error) {
    console.error("MAIRA clone authorization check failed", error);
    return res.status(502).json({ error: "Could not verify administrator access." });
  }
  const key = process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API;
  if (!key) return res.status(503).json({ error: "Voice cloning service is not configured on the server." });
  const { name, description = "", sampleBase64, fileName = "voice-sample.mp3", consent } = req.body || {};
  if (!consent) return res.status(400).json({ error: "Confirm documented permission from the voice owner." });
  if (!String(name || "").trim()) return res.status(400).json({ error: "Enter a name for this cloned voice." });
  if (!sampleBase64 || typeof sampleBase64 !== "string") return res.status(400).json({ error: "Upload a voice sample first." });
  const match = sampleBase64.match(/^data:(audio\/[A-Za-z0-9.+-]+|video\/webm|application\/octet-stream);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return res.status(400).json({ error: "Unsupported audio file. Upload MP3, WAV, M4A, AAC, OGG or WEBM." });
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 10 * 1024 * 1024) return res.status(413).json({ error: "Voice sample must be 10 MB or smaller." });
  try {
    const form = new FormData();
    form.append("name", String(name).trim().slice(0, 80));
    form.append("description", String(description).trim().slice(0, 500));
    form.append("remove_background_noise", "false");
    form.append("files", new Blob([bytes], { type: match[1] }), String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100));
    const upstream = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST", headers: { "xi-api-key": key, "Accept": "application/json" }, body: form
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error("Voice clone provider error", upstream.status, data?.detail?.status || data?.detail?.message || "");
      const message = upstream.status === 401 ? "Voice service credentials were rejected." :
        upstream.status === 402 ? "Voice service plan or credits do not allow this operation." :
        upstream.status === 403 ? "Voice cloning is not enabled for the configured account." :
        upstream.status === 422 ? "This sample could not be accepted. Try a clear recording with one speaker." :
        upstream.status === 429 ? "Voice service rate limit reached. Try again later." : "Voice cloning failed.";
      return res.status([401,402,403,422,429].includes(upstream.status) ? upstream.status : 502).json({ error: message });
    }
    return res.status(200).json({ voice_id: data.voice_id, name: data.name || String(name).trim(), category: data.category || "cloned" });
  } catch (error) {
    console.error("Voice clone request failed", error);
    return res.status(502).json({ error: "Could not connect to the voice cloning service." });
  }
}
