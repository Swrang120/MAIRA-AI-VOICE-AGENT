# MAIRA AI Voice Agent

A responsive voice-management workspace for MAIRA AI Voice Studio. The project is being developed as a hybrid platform: external licensed voice providers first, with a modular path for a future self-hosted engine.

## Current frontend
- Premium responsive dashboard UI
- Demo voice library and local-only preview
- Supabase client/auth helpers in `src/lib/supabaseClient.js` and `src/lib/voiceService.js`
- Supabase schema starter at `supabase/schema.sql`
- Profile-role protection and new-user profile trigger migration at `supabase/migrations/202610270001_protect_profile_role.sql`
- Authenticated `generate-speech` Edge Function adapter for ElevenLabs-compatible TTS

## Important status
The current dashboard still contains demo/localStorage flows. The new service modules and Edge Function are groundwork; the existing dashboard has not yet been switched over to use them. Real voice generation will only work after the Supabase database, Edge Function, provider credentials, and a voice profile with a valid provider voice ID are configured. Voice cloning itself is not yet implemented as a provider workflow.

## Local setup
1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using the public project URL and anon/publishable key.
4. Run `npm run dev`; use `npm run build` to check the production build.

## Supabase setup
1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Then run `supabase/migrations/202610270001_protect_profile_role.sql`.
4. Deploy the function: `supabase functions deploy generate-speech`.
5. Configure the Edge Function secrets in Supabase:
   - `VOICE_PROVIDER_API_KEY` — secret key for the selected provider.
   - `VOICE_PROVIDER_NAME=elevenlabs`
   - Supabase automatically provides the function runtime's `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`; never expose the service-role key in the frontend.
6. In `voice_profiles`, create an active profile and set `provider='elevenlabs'` and `provider_voice_id` to a voice ID you are authorized to use.
7. Configure Auth redirect URLs for the deployed app and review RLS policies before inviting users.

## Security and limitations
- Never commit API keys. Never expose service-role keys or provider secrets through `VITE_*` variables.
- Only clone voices you own or have explicit permission to use.
- The provider adapter checks that a caller is authenticated, resolves provider voice IDs server-side, and limits text to 5,000 characters.
- Add per-user quotas, rate limiting, generation logging, abuse monitoring, and a proper consent/upload workflow before public production.
- Voice profile IDs and provider voice IDs are different things. The MAIRA ID is a public app identifier; the provider ID is kept in the database and used only by the Edge Function.
