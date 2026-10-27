export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const key = process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API;
  if (!key) return res.status(503).json({ error: "ElevenLabs API key is not configured on the server." });
  const { name, description = "", sampleBase64, fileName = "voice-sample.mp3", consent } = req.body || {};
  if (!consent) return res.status(400).json({ error: "Confirm that you own this voice or have the speaker's permission." });
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
      console.error("ElevenLabs clone error", upstream.status, data?.detail?.status || data?.detail?.message || "");
      const message = upstream.status === 401 ? "ElevenLabs API key was rejected. Verify the key in Vercel." :
        upstream.status === 402 ? "Your ElevenLabs plan or available credits do not allow this operation." :
        upstream.status === 403 ? "Your ElevenLabs account does not have access to voice cloning." :
        upstream.status === 422 ? "ElevenLabs could not accept this sample. Try a clear recording with one speaker." :
        upstream.status === 429 ? "ElevenLabs rate limit reached. Try again later." : "Voice cloning failed. Check the sample and ElevenLabs account access.";
      return res.status([401,402,403,422,429].includes(upstream.status) ? upstream.status : 502).json({ error: message });
    }
    return res.status(200).json({ voice_id: data.voice_id, name: data.name || String(name).trim(), category: data.category || "cloned" });
  } catch (error) {
    console.error("ElevenLabs clone request failed", error);
    return res.status(502).json({ error: "Could not connect to ElevenLabs voice cloning." });
  }
}
