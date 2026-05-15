-- Numero de telefono en profiles + RPC para que solo usuarios autenticados puedan
-- leerlo. La UI lo usa como WhatsApp (link wa.me) pero el dato en si es generico
-- — un dia podemos sumar tambien Telegram/SMS sin migrar otra columna.

alter table public.profiles
  add column if not exists phone text;

-- get_profile_phone: devuelve el numero del perfil publico, pero SOLO si el caller
-- esta autenticado. Si auth.uid() es null devuelve null (no error).
create or replace function public.get_profile_phone(p_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.phone
  from profiles p
  where p.username = p_username
    and p.is_public = true
    and auth.uid() is not null
  limit 1;
$$;

revoke all on function public.get_profile_phone(text) from public;
revoke all on function public.get_profile_phone(text) from anon;
grant execute on function public.get_profile_phone(text) to authenticated;
