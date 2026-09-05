-- Closes an open email relay, and fixes the same mistake everywhere else in
-- this schema.
--
-- Every migration since 0002 has used the pattern:
--
--     revoke all on function f() from public;
--     grant execute on function f() to authenticated;
--
-- believing that blocks `anon`. It does not. Supabase's stock project setup
-- runs
--
--     alter default privileges in schema public
--       grant all on functions to postgres, anon, authenticated, service_role;
--
-- so every function created in `public` is born with an *explicit* EXECUTE
-- grant to anon and authenticated. `REVOKE ... FROM PUBLIC` removes only the
-- implicit PUBLIC grant and leaves those explicit ones untouched.
--
-- Verified against the live project before writing this: an anonymous caller
-- POSTed /rest/v1/rpc/notify_guest_email, got HTTP 204, and a row appeared in
-- email_outbox — which the cron dispatcher would then have sent through
-- Resend from the club's own domain. That is a working spam/phishing relay.
--
-- The fix is to revoke from the roles by name. Most other RPCs were already
-- safe in practice because they check auth.uid()/has_role() in their bodies,
-- but relying on that alone means one forgotten check becomes a hole; these
-- grants are the layer that should never have been open.
--
-- NOTE FOR FUTURE MIGRATIONS: always
--   revoke all on function f(...) from public, anon, authenticated;
-- and then grant back only what's needed. Revoking from `public` alone is a
-- no-op against these roles.

-- ---------------------------------------------------------------------------
-- Internal helpers — called only from inside other SECURITY DEFINER
-- functions, which run as the owner and need no grant. No client should ever
-- reach these.
-- ---------------------------------------------------------------------------

revoke all on function notify_user(uuid, text, text, text, text, text, text, uuid, uuid)
  from public, anon, authenticated;
revoke all on function notify_guest_email(text, text, text, text, uuid, uuid)
  from public, anon, authenticated;
revoke all on function get_slot_context(uuid, uuid)
  from public, anon, authenticated;
revoke all on function has_active_restriction(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Cron-only. Left reachable by anon, this let anyone fire the reminder sweep
-- early and burn the once-per-reservation reminder.
-- ---------------------------------------------------------------------------

revoke all on function enqueue_due_reminders() from public, anon, authenticated;
grant execute on function enqueue_due_reminders() to service_role;

-- ---------------------------------------------------------------------------
-- Member-only RPCs. Each already rejects an anonymous caller in its body
-- (`auth.uid() is null` or `has_role(...)`), so this is defence in depth
-- rather than a fix for a live hole — but it's the layer that should be
-- carrying the weight.
-- ---------------------------------------------------------------------------

revoke all on function reserve_slot(uuid) from public, anon;
grant execute on function reserve_slot(uuid) to authenticated;

revoke all on function cancel_reservation(uuid) from public, anon;
grant execute on function cancel_reservation(uuid) to authenticated;

revoke all on function set_slot_capacity(uuid, int) from public, anon;
grant execute on function set_slot_capacity(uuid, int) to authenticated;

revoke all on function cancel_slot(uuid) from public, anon;
grant execute on function cancel_slot(uuid) to authenticated;

revoke all on function reserved_count(availability_slots) from public, anon;
grant execute on function reserved_count(availability_slots) to authenticated;

revoke all on function mark_notification_read(uuid) from public, anon;
grant execute on function mark_notification_read(uuid) to authenticated;

revoke all on function mark_all_notifications_read() from public, anon;
grant execute on function mark_all_notifications_read() to authenticated;

revoke all on function get_slot_attendees(uuid) from public, anon;
grant execute on function get_slot_attendees(uuid) to authenticated;

revoke all on function request_tutor_courses(uuid[]) from public, anon;
grant execute on function request_tutor_courses(uuid[]) to authenticated;

revoke all on function withdraw_tutor_course(uuid) from public, anon;
grant execute on function withdraw_tutor_course(uuid) to authenticated;

revoke all on function decide_tutor_course(uuid, uuid, boolean) from public, anon;
grant execute on function decide_tutor_course(uuid, uuid, boolean) to authenticated;

revoke all on function get_pending_tutor_courses() from public, anon;
grant execute on function get_pending_tutor_courses() to authenticated;

-- ---------------------------------------------------------------------------
-- Deliberately left reachable by anon:
--
--   reserve_slot_as_guest, cancel_reservation_as_guest, get_guest_reservation,
--   get_public_open_slots, get_public_open_slot
--     — the whole point is booking without an account.
--
--   has_role(text), is_approved()
--     — these are evaluated inside RLS policy expressions, which run with the
--       *caller's* privileges. Revoking them would break every policy in the
--       database. They're also harmless: both answer only about auth.uid(),
--       so a caller learns nothing except about themselves.
-- ---------------------------------------------------------------------------
