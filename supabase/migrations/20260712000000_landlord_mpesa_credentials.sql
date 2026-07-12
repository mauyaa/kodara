-- Per-landlord M-Pesa credentials. Kodara is a multi-landlord platform: every
-- landlord must collect rent into their own Paybill/Till, never a shared one.
-- Secret material lives in Supabase Vault; this table only stores vault
-- secret ids plus non-secret connection metadata. Nothing here is granted to
-- anon/authenticated directly -- access is only through the RPCs below.

create table private.landlord_mpesa_credentials (
  landlord_id uuid primary key references public.profiles(id) on delete cascade,
  environment text not null default 'sandbox'
    constraint landlord_mpesa_credentials_environment_check
    check (environment in ('sandbox', 'production')),
  shortcode text not null
    constraint landlord_mpesa_credentials_shortcode_check
    check (shortcode ~ '^[0-9]{5,7}$'),
  vault_consumer_key_id uuid not null,
  vault_consumer_secret_id uuid not null,
  vault_passkey_id uuid not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger landlord_mpesa_credentials_set_updated_at
before update on private.landlord_mpesa_credentials
for each row execute function private.set_updated_at();

-- Upsert (create or rotate) the caller's own M-Pesa credentials. Secret
-- values pass through once and are never selectable again except by the
-- service-role-only getter below.
create or replace function public.set_landlord_mpesa_credentials(
  target_shortcode text,
  target_consumer_key text,
  target_consumer_secret text,
  target_passkey text,
  target_environment text default 'sandbox'
)
returns table (environment text, shortcode text, verified_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  existing private.landlord_mpesa_credentials;
  key_id uuid;
  secret_id uuid;
  passkey_id uuid;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not (select private.current_user_is_landlord()) then
    raise exception 'landlord account required' using errcode = '42501';
  end if;
  if target_shortcode !~ '^[0-9]{5,7}$' then
    raise exception 'invalid M-Pesa shortcode' using errcode = '22023';
  end if;
  if length(coalesce(target_consumer_key, '')) < 8
    or length(coalesce(target_consumer_secret, '')) < 8
    or length(coalesce(target_passkey, '')) < 8 then
    raise exception 'invalid M-Pesa credentials' using errcode = '22023';
  end if;
  if target_environment not in ('sandbox', 'production') then
    raise exception 'invalid environment' using errcode = '22023';
  end if;

  select * into existing
  from private.landlord_mpesa_credentials
  where landlord_id = caller_id;

  if existing.landlord_id is not null then
    perform vault.update_secret(existing.vault_consumer_key_id, target_consumer_key);
    perform vault.update_secret(existing.vault_consumer_secret_id, target_consumer_secret);
    perform vault.update_secret(existing.vault_passkey_id, target_passkey);

    update private.landlord_mpesa_credentials
    set shortcode = target_shortcode,
        environment = target_environment,
        verified_at = null
    where landlord_id = caller_id;
  else
    key_id := vault.create_secret(target_consumer_key, 'mpesa_consumer_key:' || caller_id);
    secret_id := vault.create_secret(target_consumer_secret, 'mpesa_consumer_secret:' || caller_id);
    passkey_id := vault.create_secret(target_passkey, 'mpesa_passkey:' || caller_id);

    insert into private.landlord_mpesa_credentials (
      landlord_id, environment, shortcode,
      vault_consumer_key_id, vault_consumer_secret_id, vault_passkey_id
    ) values (
      caller_id, target_environment, target_shortcode,
      key_id, secret_id, passkey_id
    );
  end if;

  return query
  select c.environment, c.shortcode, c.verified_at
  from private.landlord_mpesa_credentials c
  where c.landlord_id = caller_id;
end;
$$;

create or replace function public.landlord_mpesa_connection_status()
returns table (connected boolean, environment text, masked_shortcode text, verified_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.landlord_id is not null,
    c.environment,
    case when c.shortcode is not null then repeat('*', greatest(length(c.shortcode) - 3, 0)) || right(c.shortcode, 3) end,
    c.verified_at
  from (select (select auth.uid()) as id) me
  left join private.landlord_mpesa_credentials c on c.landlord_id = me.id;
$$;

create or replace function public.disconnect_landlord_mpesa()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.landlord_mpesa_credentials where landlord_id = (select auth.uid());
end;
$$;

-- Service-role-only, but must live in `public`: PostgREST (and therefore
-- serviceClient.rpc(...) in edge functions) only resolves functions in the
-- schemas exposed by config.toml's `api.schemas`, which does not include
-- `private`. Access is still restricted purely by GRANT, exactly like
-- `public.run_rent_reminders()`'s "service-only public wrapper" above --
-- anon/authenticated have no execute grant, so PostgREST rejects them.
create or replace function public.get_landlord_mpesa_credentials(target_landlord_id uuid)
returns table (
  shortcode text,
  consumer_key text,
  consumer_secret text,
  passkey text,
  environment text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.shortcode,
    ck.decrypted_secret,
    cs.decrypted_secret,
    pk.decrypted_secret,
    c.environment
  from private.landlord_mpesa_credentials c
  join vault.decrypted_secrets ck on ck.id = c.vault_consumer_key_id
  join vault.decrypted_secrets cs on cs.id = c.vault_consumer_secret_id
  join vault.decrypted_secrets pk on pk.id = c.vault_passkey_id
  where c.landlord_id = target_landlord_id;
$$;

create or replace function public.mark_landlord_mpesa_verified(target_landlord_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.landlord_mpesa_credentials
  set verified_at = now()
  where landlord_id = target_landlord_id;
$$;

revoke execute on function public.set_landlord_mpesa_credentials(text, text, text, text, text) from public, anon;
grant execute on function public.set_landlord_mpesa_credentials(text, text, text, text, text) to authenticated;
revoke execute on function public.landlord_mpesa_connection_status() from public, anon;
grant execute on function public.landlord_mpesa_connection_status() to authenticated;
revoke execute on function public.disconnect_landlord_mpesa() from public, anon;
grant execute on function public.disconnect_landlord_mpesa() to authenticated;
revoke execute on function public.get_landlord_mpesa_credentials(uuid) from public, anon, authenticated;
grant execute on function public.get_landlord_mpesa_credentials(uuid) to service_role;
revoke execute on function public.mark_landlord_mpesa_verified(uuid) from public, anon, authenticated;
grant execute on function public.mark_landlord_mpesa_verified(uuid) to service_role;
