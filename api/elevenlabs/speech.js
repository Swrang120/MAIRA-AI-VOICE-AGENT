import crypto from "node:crypto";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const authorization = String(req.headers.authorization || "");
  if (!authorization.startsWith("Bearer ")) return res.status(401).json({ error: "Sign in to generate audio with your MAIRA voices." });
  const key = process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API;
  if (!key) return res.status(503).json({ error: "Voice service is not configured on the server." });
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const voiceId = String(req.body?.voiceId || "").trim();
  const text = String(req.body?.text || "").trim();
  if (!voiceId || !text) return res.status(400).json({ error: "Choose a voice and enter text first." });
  if (text.length > 5000) return res.status(413).json({ error: "Text must be 5,000 characters or fewer." });
  if (!/^[A-Za-z0-9_-]{5,100}$/.test(voiceId)) return res.status(400).json({ error: "Invalid voice ID." });
  if (!supabaseUrl || !supabaseKey || !serviceKey) return res.status(503).json({ error: "MAIRA database is not fully configured on the server." });
  try {
    const base = supabaseUrl.replace(/\/$/, "");
    const authCheck = await fetch(base + "/auth/v1/user", { headers: { apikey: supabaseKey, Authorization: authorization } });
    if (!authCheck.ok) return res.status(401).json({ error: "Your session expired. Please sign in again." });
    const user = await authCheck.json();
    const verify = await fetch(base + "/rest/v1/voice_profiles?select=id&provider_voice_id=eq." + encodeURIComponent(voiceId) + "&status=eq.active&limit=1", {
      headers: { apikey: supabaseKey, Authorization: authorization, Accept: "application/json" }
    });
    const permitted = await verify.json().catch(() => []);
    if (!verify.ok) return res.status(401).json({ error: "Could not verify voice access. Please sign in again." });
    if (!Array.isArray(permitted) || permitted.length === 0) return res.status(403).json({ error: "This voice is private or is not assigned to your account." });
    const upstream = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + encodeURIComponent(voiceId) + "?output_format=mp3_44100_128", {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg" },
      body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } })
    });
    if (!upstream.ok) {
      const body = await upstream.text();
      console.error("ElevenLabs speech error", upstream.status, body.slice(0, 300));
      const status = [400, 401, 402, 403, 404, 429].includes(upstream.status) ? upstream.status : 502;
      const message = upstream.status === 401 ? "Voice service credentials were rejected." :
        upstream.status === 402 ? "Voice service needs available credits or plan access." :
        upstream.status === 403 ? "This voice or feature is not available." :
        upstream.status === 404 ? "Voice not found. Refresh the voice list." :
        upstream.status === 429 ? "Voice service rate limit reached. Try again shortly." :
        "Speech generation failed. Check the selected voice and service access.";
      return res.status(status).json({ error: message });
    }
    const audio = Buffer.from(await upstream.arrayBuffer());
    // Charge only after the provider returned a successful audio payload. Never charge browser previews or STT.
    const coins = Math.max(1, Math.ceil(text.length / 100));
    const debit = await fetch(base + "/rpc/debit_tts_coins", {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json" },
      body: JSON.stringify({ p_user_id: user.id, p_coins: coins, p_reference: "tts:" + crypto.randomUUID(), p_note: "TTS " + text.length + " characters (" + coins + " coins)" })
    });
    if (!debit.ok) {
      const detail = await debit.text();
      if (detail.includes("INSUFFICIENT_COINS")) return res.status(402).json({ error: "Not enough MAIRA Coins. Buy a coin pack to generate this audio." });
      console.error("TTS debit failed", debit.status, detail.slice(0,200));
      return res.status(503).json({ error: "Audio was generated but your wallet could not be charged safely. No audio was delivered; please retry." });
    }
    res.setHeader("X-Maira-Coins-Charged", String(coins));
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", 'inline; filename="maira-speech.mp3"');
    res.setHeader("Content-Length", String(audio.length));
    return res.status(200).send(audio);
  } catch (e) {
    console.error("Speech request failed", e);
    return res.status(502).json({ error: "Unable to connect to the voice service." });
  }
}
