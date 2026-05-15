-- public_trade_matches: lista usuarios publicos con potencial de canje
-- contra el usuario logeado (auth.uid()).
--
-- Devuelve por cada candidato:
--   their_dupes_for_me  = sus repetidas (owned + dupes > 0) que YO no tengo owned
--   my_dupes_for_them   = mis repetidas (owned + dupes > 0) que ELLOS no tienen owned
--
-- Orden: their_dupes_for_me DESC, my_dupes_for_them DESC. LIMIT 100.
-- Filtra usuarios sin overlap en ninguno de los dos sentidos.
-- SECURITY DEFINER para saltar RLS de forma controlada (solo perfiles is_public=true).

create or replace function public.public_trade_matches()
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  owned_count int,
  dupes_count int,
  their_dupes_for_me int,
  my_dupes_for_them int
)
language sql
stable
security definer
set search_path = public
as $$
  with me_id as (
    select auth.uid() as uid
  ),
  my_owned as (
    select s.sticker_number
    from stickers s, me_id
    where s.user_id = me_id.uid and s.owned = true
  ),
  my_dupes as (
    select s.sticker_number
    from stickers s, me_id
    where s.user_id = me_id.uid and s.owned = true and s.dupes > 0
  ),
  candidates as (
    select p.id, p.username, p.display_name, p.avatar_url
    from profiles p, me_id
    where p.is_public = true and p.id <> me_id.uid
  ),
  computed as (
    select
      c.id as user_id,
      c.username,
      c.display_name,
      c.avatar_url,
      coalesce(agg.owned_count, 0)::int as owned_count,
      coalesce(agg.dupes_count, 0)::int as dupes_count,
      coalesce(their.cnt, 0)::int as their_dupes_for_me,
      coalesce(mine.cnt, 0)::int as my_dupes_for_them
    from candidates c
    left join lateral (
      select
        count(*) filter (where owned = true)::int as owned_count,
        coalesce(sum(dupes) filter (where owned = true), 0)::int as dupes_count
      from stickers
      where user_id = c.id
    ) agg on true
    left join lateral (
      select count(*)::int as cnt
      from stickers t
      where t.user_id = c.id
        and t.owned = true
        and t.dupes > 0
        and t.sticker_number not in (select sticker_number from my_owned)
    ) their on true
    left join lateral (
      select count(*)::int as cnt
      from my_dupes md
      where md.sticker_number not in (
        select sticker_number from stickers t
        where t.user_id = c.id and t.owned = true
      )
    ) mine on true
  )
  select
    user_id, username, display_name, avatar_url,
    owned_count, dupes_count,
    their_dupes_for_me, my_dupes_for_them
  from computed
  where owned_count > 0
    and (their_dupes_for_me > 0 or my_dupes_for_them > 0)
  order by their_dupes_for_me desc, my_dupes_for_them desc
  limit 100;
$$;

-- Solo usuarios autenticados pueden llamar a esta función.
revoke all on function public.public_trade_matches() from public;
revoke all on function public.public_trade_matches() from anon;
grant execute on function public.public_trade_matches() to authenticated;
