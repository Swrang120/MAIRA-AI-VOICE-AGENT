import { supabase, supabaseConfigured } from "./supabaseClient";

/**
 * Client-side helpers for MAIRA's authenticated voice workflows.
 * Provider credentials and provider voice IDs must remain server-side.
 */
function requireSupabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your deployment environment.");
  }
  return supabase;
}

export async function getCurrentSession() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signInWithEmail(email, password) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email, password, displayName = "") {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function fetchActiveVoices() {
  const client = requireSupabase();
  const { data, error } = await client
    .from("voice_profiles")
    .select("id, public_voice_id, name, language, profile_type, description, status")
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function submitCloneRequest({ name, language, notes, consentConfirmed }) {
  const client = requireSupabase();
  if (!consentConfirmed) throw new Error("Please confirm that you own the voice or have permission to use it.");
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Sign in before submitting a voice request.");

  const requestCode = `CL-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
  const { data, error } = await client.from("voice_clone_requests").insert({
    request_code: requestCode,
    requested_name: name.trim(),
    language,
    notes: notes?.trim() || null,
    requester_id: userData.user.id,
    consent_confirmed: true,
  }).select("id, request_code, requested_name, language, status, created_at").single();
  if (error) throw error;
  return data;
}

export async function generateSpeech({ voiceId, text }) {
  const client = requireSupabase();
  const cleanText = String(text ?? "").trim();
  if (!cleanText) throw new Error("Enter some text to generate speech.");
  if (cleanText.length > 5000) throw new Error("Text must be 5,000 characters or fewer.");

  const { data, error } = await client.functions.invoke("generate-speech", {
    body: { voiceId, text: cleanText },
  });
  if (error) throw error;
  if (!data?.audioBase64) throw new Error("Voice provider returned no audio.");
  const binary = atob(data.audioBase64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: data.contentType || "audio/mpeg" });
}
