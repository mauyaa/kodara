-- Production error tracking (Tier 4). Today every error boundary and catch
-- block only does `console.error`, which is invisible once deployed --
-- there is currently zero production visibility into failures a landlord or
-- tenant hits after a release. This adds a minimal, self-contained error log:
-- no third-party account to sign up for (Sentry needs a DSN this session
-- can't provision), just a private table plus a narrow RPC any client --
-- authenticated or not, since the public marketing page can error too --
-- can call to report one. Write-only from the client's perspective, exactly
-- like this schema's other client-facing RPCs (record_manual_payment,
-- resolve_unmatched_payment): the table itself stays in `private` and is
-- only ever read via the Supabase SQL editor or a future admin view.

create table private.error_events (
  id bigint generated always as identity primary key,
  message text not null constraint error_events_message_check check (char_length(message) between 1 and 2000),
  stack text constraint error_events_stack_check check (stack is null or char_length(stack) <= 8000),
  digest text constraint error_events_digest_check check (digest is null or char_length(digest) <= 200),
  context text constraint error_events_context_check check (context is null or char_length(context) <= 200),
  url text constraint error_events_url_check check (url is null or char_length(url) <= 500),
  profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index error_events_created_at_idx on private.error_events (created_at desc);

revoke all on private.error_events from public, anon, authenticated;

create or replace function public.log_client_error(
  error_message text,
  error_stack text default null,
  error_digest text default null,
  error_context text default null,
  page_url text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.error_events (message, stack, digest, context, url, profile_id)
  values (
    left(coalesce(error_message, 'unknown error'), 2000),
    left(error_stack, 8000),
    left(error_digest, 200),
    left(error_context, 200),
    left(page_url, 500),
    (select auth.uid())
  );
exception when others then
  -- Logging must never itself break the app or surface a second error to
  -- the client that's already in a broken state.
  null;
end;
$$;

revoke execute on function public.log_client_error(text, text, text, text, text) from public;
grant execute on function public.log_client_error(text, text, text, text, text) to authenticated, anon;
