export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const key = process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API;
  if (!key) return res.status(503).json({ error: "ElevenLabs server environment variable is missing. Add ELEVENLABS_API_KEY in Vercel." });
  const voiceId = String(req.body?.voiceId || "").trim();
  const text = String(req.body?.text || "").trim();
  if (!voiceId || !text) return res.status(400).json({ error: "Choose a voice and enter text first." });
  if (text.length > 5000) return res.status(413).json({ error: "Text must be 5,000 characters or fewer." });
  if (!/^[A-Za-z0-9_-]{5,100}$/.test(voiceId)) return res.status(400).json({ error: "Invalid voice ID." });
  try {
    const upstream = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + encodeURIComponent(voiceId) + "?output_format=mp3_44100_128", {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg" },
      body: JSON.stringify({
        text, model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    });
    if (!upstream.ok) {
      const body = await upstream.text();
      console.error("ElevenLabs speech error", upstream.status, body.slice(0, 300));
      const status = [400, 401, 402, 403, 404, 429].includes(upstream.status) ? upstream.status : 502;
      const message = upstream.status === 401 ? "ElevenLabs API key was rejected. Check the Vercel environment variable." :
        upstream.status === 402 ? "ElevenLabs account needs available credits or plan access." :
        upstream.status === 403 ? "This voice or feature is not available to your API key." :
        upstream.status === 404 ? "Voice not found. Refresh the voice list and select another voice." :
        upstream.status === 429 ? "ElevenLabs rate limit reached. Try again shortly." :
        "Speech generation failed. Check the selected voice and API access.";
      return res.status(status).json({ error: message });
    }
    const audio = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", 'inline; filename="maira-speech.mp3"');
    res.setHeader("Content-Length", String(audio.length));
    return res.status(200).send(audio);
  } catch (e) {
    console.error("Speech request failed", e);
    return res.status(502).json({ error: "Unable to connect to ElevenLabs." });
  }
}
