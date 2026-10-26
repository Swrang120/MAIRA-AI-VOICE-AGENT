# MAIRA AI Voice Agent

A responsive voice-management workspace for MAIRA AI Voice Studio.

## Current build
- Premium responsive dashboard UI
- Voice library with named profiles and unique demo IDs
- Browser speech preview (uses the device/browser's installed speech voices)
- Voice cloning request submission UI
- Admin preview controls for local demonstration
- Supabase schema starter at `supabase/schema.sql`

## Important limitations
This initial UI is not yet a production voice-cloning service. Voice profiles and clone requests currently persist in the current browser's local storage. The admin toggle is a demo-only UI and is not secure authentication. Browser speech preview is not a cloned voice and does not use provider voice IDs.

## Run locally
```bash
npm install
npm run dev
```

## Next integration steps
1. Create a Supabase project and review/apply `supabase/schema.sql`.
2. Add Supabase Auth, user profiles, verified admin roles, and secure RLS.
3. Choose a licensed voice provider that supports custom voices/voice cloning.
4. Store provider voice IDs server-side; generate MAIRA public IDs independently.
5. Build authenticated Edge Functions for speech generation, cloning, provider callbacks, usage logging, and rate limits.
6. Add private audio storage and explicit consent verification for any voice sample.
7. Test access control, deletion, provider failures, and usage limits before public launch.

## Security
Never commit API keys. Never expose service-role keys or voice provider secrets through frontend variables. Only clone voices you own or have explicit permission to use.
