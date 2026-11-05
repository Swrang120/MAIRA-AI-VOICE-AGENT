-- Restrict SECURITY DEFINER helper/trigger functions to intended callers.
-- is_maira_admin remains executable by authenticated users because RLS policies call it.
REVOKE ALL ON FUNCTION public.is_maira_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_maira_admin() TO authenticated;

-- Trigger/event-trigger functions are not direct RPC endpoints.
REVOKE ALL ON FUNCTION public.prevent_profile_role_escalation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_maira_profile_from_auth() FROM PUBLIC, anon, authenticated;
