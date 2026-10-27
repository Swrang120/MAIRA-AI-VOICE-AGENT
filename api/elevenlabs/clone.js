export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const authorization = String(req.headers.authorization || "");
  if (!authorization.startsWith("Bearer ")) return res.status(401).json({ error: "Admin sign-in is required to create voice clones." });
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceKey) return res.status(503).json({ error: "Database setup incomplete. Configure Supabase URL, anon key and server-only SUPABASE_SERVICE_ROLE_KEY in Vercel." });
  let identity;
  try {
    const ir = await fetch(supabaseUrl + "/auth/v1/user", { headers: { apikey: anonKey, Authorization: authorization, Accept: "application/json" } });
    identity = await ir.json().catch(() => ({}));
    if (!ir.ok || !identity.id) return res.status(401).json({ error: "Sign in again to verify administrator access." });
    const rr = await fetch(supabaseUrl + "/rest/v1/profiles?select=role&id=eq." + encodeURIComponent(identity.id) + "&limit=1", { headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey, Accept: "application/json" } });
    const roles = await rr.json().catch(() => []);
    if (!rr.ok || roles?.[0]?.role !== "admin") return res.status(403).json({ error: "Only an authorized MAIRA administrator can create voice clones." });
  } catch (error) {
    console.error("MAIRA clone authorization check failed", error);
    return res.status(502).json({ error: "Could not verify administrator access." });
  }
  const key = process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API;
  if (!key) return res.status(503).json({ error: "Voice cloning service is not configured on the server." });
  const { name, description = "", sampleBase64, fileName = "voice-sample.mp3", consent, language = "Multilingual", gender = "Not specified", profileType = "Custom", destination = "private", customerEmail = "" } = req.body || {};
  if (!consent) return res.status(400).json({ error: "Confirm documented permission from the voice owner." });
  if (!String(name || "").trim()) return res.status(400).json({ error: "Enter a name for this cloned voice." });
  if (!["private", "public", "customer"].includes(destination)) return res.status(400).json({ error: "Choose a valid destination." });
  if (destination === "customer" && !/^\S+@\S+\.\S+$/.test(String(customerEmail).trim())) return res.status(400).json({ error: "Enter a valid customer email address." });
  if (!sampleBase64 || typeof sampleBase64 !== "string") return res.status(400).json({ error: "Upload a voice sample first." });
  const match = sampleBase64.match(/^data:(audio\/[A-Za-z0-9.+-]+|video\/webm|application\/octet-stream);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return res.status(400).json({ error: "Unsupported audio file. Upload a supported audio sample." });
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) return res.status(413).json({ error: "Voice sample must be between 1 byte and 10 MB." });
  let recipientId = null;
  if (destination === "customer") {
    try {
      const usersResponse = await fetch(supabaseUrl + "/auth/v1/admin/users?page=1&per_page=1000", { headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey, Accept: "application/json" } });
      const usersPayload = await usersResponse.json().catch(() => ({}));
      const users = Array.isArray(usersPayload) ? usersPayload : (usersPayload.users || []);
      const target = users.find(u => String(u.email || "").toLowerCase() === String(customerEmail).trim().toLowerCase());
      if (!usersResponse.ok) return res.status(502).json({ error: "Could not look up the customer account." });
      if (!target) return res.status(404).json({ error: "No MAIRA account found for that email. Ask the customer to sign up first." });
      recipientId = target.id;
    } catch (error) {
      console.error("MAIRA recipient lookup failed", error);
      return res.status(502).json({ error: "Could not look up the customer account." });
    }
  }
  let voiceData;
  try {
    const form = new FormData();
    form.append("name", String(name).trim().slice(0, 80));
    form.append("description", String(description).trim().slice(0, 500));
    form.append("remove_background_noise", "false");
    form.append("files", new Blob([bytes], { type: match[1] }), String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100));
    const upstream = await fetch("https://api.elevenlabs.io/v1/voices/add", { method: "POST", headers: { "xi-api-key": key, "Accept": "application/json" }, body: form });
    voiceData = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error("Voice clone provider error", upstream.status, voiceData?.detail?.status || voiceData?.detail?.message || "");
      const message = upstream.status === 401 ? "Voice service credentials were rejected." : upstream.status === 402 ? "Voice service plan or credits do not allow this operation." : upstream.status === 403 ? "Voice cloning is not enabled for the configured account." : upstream.status === 422 ? "This sample could not be accepted. Try a clear recording with one speaker." : upstream.status === 429 ? "Voice service rate limit reached. Try again later." : "Voice cloning failed.";
      return res.status([401,402,403,422,429].includes(upstream.status) ? upstream.status : 502).json({ error: message });
    }
    if (!voiceData.voice_id) throw new Error("Voice provider returned no voice ID.");
  } catch (error) {
    console.error("Voice clone request failed", error);
    return res.status(502).json({ error: "Could not connect to the voice cloning service." });
  }
  const baseProfile = {
    public_voice_id: "MR-" + String(voiceData.voice_id).replace(/[^a-zA-Z0-9]/g, "").slice(0, 24),
    name: String(voiceData.name || name).trim().slice(0, 80),
    language: String(language).slice(0, 40),
    gender: String(gender).slice(0, 30),
    profile_type: String(profileType).slice(0, 60),
    description: String(description).trim().slice(0, 500),
    status: "active",
    provider: "elevenlabs",
    provider_voice_id: voiceData.voice_id,
    consent_confirmed: true,
    created_by: identity.id,
    owner_id: identity.id,
    visibility: "private",
    public_listing_consent: false
  };
  const headers = { apikey: serviceKey, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json", Prefer: "return=representation" };
  try {
    // The original private copy is always retained. Destination copies are separate records referencing the same provider voice.
    const savePrivate = await fetch(supabaseUrl + "/rest/v1/voice_profiles", { method: "POST", headers, body: JSON.stringify(baseProfile) });
    const privateRows = await savePrivate.json().catch(() => []);
    if (!savePrivate.ok || !privateRows?.[0]?.id) {
      console.error("Private voice profile save failed", savePrivate.status, privateRows);
      return res.status(502).json({ error: "Clone created at provider, but saving your private library failed. Check the voice_profiles schema and server configuration." });
    }
    if (destination === "public" || destination === "customer") {
      const copy = { ...baseProfile, public_voice_id: baseProfile.public_voice_id + "-" + (destination === "public" ? "PUB" : "USR"), owner_id: destination === "customer" ? recipientId : identity.id, visibility: destination === "public" ? "public" : "private", public_listing_consent: destination === "public", public_listing_consent_at: destination === "public" ? new Date().toISOString() : null };
      const saveCopy = await fetch(supabaseUrl + "/rest/v1/voice_profiles", { method: "POST", headers, body: JSON.stringify(copy) });
      const copyRows = await saveCopy.json().catch(() => []);
      if (!saveCopy.ok || !copyRows?.[0]?.id) {
        console.error("Destination voice copy save failed", saveCopy.status, copyRows);
        return res.status(502).json({ error: "Private copy was saved, but destination copy failed. Retry the destination assignment from Admin after checking database setup.", voice_id: voiceData.voice_id, private_saved: true });
      }
    }
    return res.status(200).json({ voice_id: voiceData.voice_id, public_voice_id: baseProfile.public_voice_id, name: baseProfile.name, category: baseProfile.profile_type, destination, private_saved: true });
  } catch (error) {
    console.error("MAIRA voice profile save failed", error);
    return res.status(502).json({ error: "Clone created, but MAIRA could not save the library records." });
  }
}
