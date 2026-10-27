import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const providerKey = Deno.env.get("VOICE_PROVIDER_API_KEY");
  const providerName = (Deno.env.get("VOICE_PROVIDER_NAME") || "elevenlabs").toLowerCase();

  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Server auth is not configured." }, 500);
  if (!providerKey) return json({ error: "Voice provider is not configured. Add VOICE_PROVIDER_API_KEY as a server-side secret." }, 503);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Sign in is required." }, 401);

  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Your session is invalid or expired." }, 401);

    const payload = await req.json();
    const voiceId = String(payload?.voiceId || "").trim();
    const text = String(payload?.text || "").trim();
    if (!voiceId || !text) return json({ error: "voiceId and text are required." }, 400);
    if (text.length > 5000) return json({ error: "Text must be 5,000 characters or fewer." }, 413);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: voice, error: voiceError } = await adminClient
      .from("voice_profiles")
      .select("public_voice_id, provider, provider_voice_id, status, consent_confirmed")
      .eq("public_voice_id", voiceId)
      .eq("status", "active")
      .maybeSingle();

    if (voiceError) return json({ error: "Unable to load the selected voice profile." }, 500);
    if (!voice) return json({ error: "Active voice profile not found." }, 404);
    if (!voice.provider_voice_id) return json({ error: "This profile has no provider voice configured yet." }, 409);

    // The first adapter supports ElevenLabs-compatible text-to-speech.
    // Provider-specific voice IDs are looked up server-side and never sent by the browser.
    if (providerName !== "elevenlabs" || (voice.provider && voice.provider.toLowerCase() !== "elevenlabs")) {
      return json({ error: "This voice is not configured for the current provider adapter." }, 409);
    }

    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice.provider_voice_id)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": providerKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          output_format: "mp3_44100_128",
        }),
      },
    );

    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 400);
      console.error("Voice provider error", upstream.status, detail);
      return json({ error: upstream.status === 429 ? "Voice provider rate limit reached." : "Voice generation failed. Check provider settings and voice permissions." }, upstream.status === 429 ? 429 : 502);
    }

    const audio = new Uint8Array(await upstream.arrayBuffer());
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < audio.length; offset += chunkSize) {
      binary += String.fromCharCode(...audio.subarray(offset, offset + chunkSize));
    }
    return json({ audioBase64: btoa(binary), contentType: "audio/mpeg" });
  } catch (error) {
    console.error("generate-speech failed", error);
    return json({ error: "Unexpected voice generation error." }, 500);
  }
});
