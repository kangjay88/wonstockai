-- verify-rls.sql
-- Paste into the Supabase SQL editor (or run via `supabase db execute`) to
-- audit Row Level Security across the public schema.
--
-- Run this after every migration. What you want to see:
--   * Every table: rls_enabled = true AND policy_count > 0
--   * verdict = 'OK' on every row
--
-- Danger verdicts:
--   * 'DANGER: RLS OFF'      -> table is exposed via the anon REST API to anyone
--   * 'WARN: RLS ON, NO POLICY' -> RLS denies all access; app reads silently fail

-- ---------------------------------------------------------------------------
-- 1. Per-table RLS + policy summary
-- ---------------------------------------------------------------------------
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  count(p.policyname) as policy_count,
  case
    when not c.relrowsecurity then 'DANGER: RLS OFF'
    when count(p.policyname) = 0 then 'WARN: RLS ON, NO POLICY'
    else 'OK'
  end as verdict
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p
  on p.schemaname = n.nspname and p.tablename = c.relname
where n.nspname = 'public'
  and c.relkind = 'r'            -- ordinary tables only
group by c.relname, c.relrowsecurity, c.relforcerowsecurity
order by verdict <> 'OK' desc,   -- problems float to the top
         c.relname;

-- ---------------------------------------------------------------------------
-- 2. Policy detail — confirm each policy gates on the owning user
-- ---------------------------------------------------------------------------
select
  tablename,
  policyname,
  cmd,                            -- ALL / SELECT / INSERT / UPDATE / DELETE
  roles,
  qual as using_expression,       -- should reference auth.uid() = user_id
  with_check as with_check_expression
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
