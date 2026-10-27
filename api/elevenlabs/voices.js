export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const key = process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API;
  if (!key) return res.status(503).json({ error: "ElevenLabs server environment variable is missing. Add ELEVENLABS_API_KEY in Vercel." });
  try {
    const upstream = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": key, "Accept": "application/json" }
    });
    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error("ElevenLabs voices error", upstream.status, payload?.detail?.status || payload?.detail?.message || "");
      return res.status(upstream.status === 401 ? 401 : upstream.status === 429 ? 429 : 502).json({
        error: upstream.status === 401 ? "ElevenLabs API key was rejected. Check the Vercel environment variable." :
          upstream.status === 429 ? "ElevenLabs rate limit reached. Try again later." : "Unable to load voices from ElevenLabs."
      });
    }
    const voices = (payload.voices || []).map(v => ({
      voice_id: v.voice_id, name: v.name || "Unnamed voice",
      category: v.category || "voice", labels: v.labels || {},
      preview_url: v.preview_url || null
    }));
    return res.status(200).json({ voices });
  } catch (e) {
    console.error("Voice list request failed", e);
    return res.status(502).json({ error: "Unable to connect to ElevenLabs." });
  }
}
