# Incident: landlords could not create properties

| | |
| --- | --- |
| **Status** | Resolved in code; production migration pending |
| **Introduced** | 2026-07-22, migration `20260722040000_property_staff` |
| **Fixed** | 2026-10-22, migration `20261022000000_properties_select_owner` |
| **Severity** | High: blocks onboarding for every new landlord |
| **Data impact** | None. Writes were rejected, not corrupted; payments were unaffected |

## Summary

Adding caretaker and staff accounts changed the `properties` SELECT policy to
check ownership only through `private.is_landlord_of_property(id)`. That
helper finds the property by its id. During `INSERT ... RETURNING`, the row
being inserted is not yet visible to that lookup, so the RETURNING check
failed and PostgreSQL rejected the insert with `42501: new row violates
row-level security policy for table "properties"`.

The web app creates properties with `supabase.from("properties").insert(...).select()`,
which PostgREST executes as `INSERT ... RETURNING`. Every attempt to add a
property, including a new landlord's first one during onboarding, failed on
any database with the July migration applied.

## Timeline (UTC)

| When | What happened |
| --- | --- |
| 2026-07-22 14:18 | Staff-accounts change merged to `main`. CI `backend-check` fails at `test:realtime`. Vercel's Git integration deploys the web app anyway. |
| 2026-07-22 → 2026-10-21 | `main` stays red. The deploy job was also failing on every push for an unrelated reason (a missing `VERCEL_TOKEN`), so a red pipeline had become normal and was not investigated. |
| 2026-10-21 21:00 | A fresh CI run on `main` captures the error text: `new row violates row-level security policy for table "properties"`. |
| 2026-10-21 21:12 | Root cause traced to the policy change; fix opened as PR #1. |
| 2026-10-22 | Fix merged after a full green CI run. The always-failing deploy job is removed so that red means broken again. |

## Root cause

```sql
-- 20260722040000_property_staff
create policy properties_select_authorized on public.properties
for select to authenticated
using (
  (select private.is_landlord_of_property(id))
  or (select private.is_tenant_of_property(id))
);
```

`is_landlord_of_property(id)` runs `select ... from public.properties p where p.id = target_property_id`.
For a row that is still being inserted, that query returns nothing, so the
owner fails the check that RETURNING applies. The previous policy compared
`landlord_id = auth.uid()` on the row itself, which works for new rows.
`properties` was the only table whose policy looked itself up by its own id;
`units` and `tenancies` check through their parent row, which already exists.

## Why it was not caught

1. **The database tests never exercised the failing path.** pgTAP inserted
   properties either as the table owner (bypassing RLS) or without
   `RETURNING`. Only the end-to-end realtime test used `insert().select()`
   the way the app does.
2. **The failing test was treated as noise.** The realtime test was already
   intermittently flaky, and the deploy job failed on every run, so
   `backend-check` failing did not stand out.
3. **Deployment was not gated on CI.** Vercel deploys every push to `main`
   regardless of the pipeline result.

## Fix

`20261022000000_properties_select_owner.sql` restores the direct ownership
check alongside the staff and tenant helpers:

```sql
using (
  landlord_id = (select auth.uid())
  or (select private.is_landlord_of_property(id))
  or (select private.is_tenant_of_property(id))
);
```

Staff and tenant access are unchanged.

## Follow-up

| Action | Status |
| --- | --- |
| Restore the owner check on `properties_select_authorized` | Done |
| Regression test that runs `INSERT ... RETURNING` as a landlord (`supabase/tests/database/property_insert_returning.test.sql`) | Done |
| Remove the always-failing deploy job so a red pipeline is a real signal | Done |
| Apply the migration to production (`supabase db push`) | **Open** |
| Gate production deploys on CI (Vercel deployment checks) | Open |
| Make the realtime end-to-end test deterministic; it passed on retry with no code change | Open |
| When a policy delegates to a helper, test the RETURNING path for that table | Adopted as a review rule |

## Lessons

- A policy that is correct for reads can still be wrong for writes:
  PostgreSQL applies the SELECT policy to `RETURNING`.
- A pipeline that is always red stops being a signal. Fix or remove a
  failing job immediately rather than learning to ignore it.
