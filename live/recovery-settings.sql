-- Glavni sajt: dodatna priprema 30.10.2026. Postojeći podaci se ne brišu.
begin;
create table community_live.recovery_settings(singleton boolean primary key default true check(singleton),enabled boolean not null default false,mail_key_ciphertext text,sender text not null default 'onboarding@resend.dev');
insert into community_live.recovery_settings(singleton) values(true);
alter table community_live.recovery_settings enable row level security;
revoke all on community_live.recovery_settings from public,anon,authenticated;
grant all on community_live.recovery_settings to service_role;
create function public.community_live_recovery_settings(p_action text,p_args jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s community_live.recovery_settings;c community_live.security_settings;
begin
 if current_user not in ('service_role','postgres') then raise exception 'Zabranjeno.' using errcode='42501';end if;
 if p_action in ('get','set') then
  perform community_live.assert_admin_access((p_args->>'_uid')::uuid,p_args->>'_session_id','aal1');
  if p_action='set' then
   if length(coalesce(p_args->>'sender','')) not between 3 and 254 or p_args->>'sender' !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$' then raise exception 'Unesi adresu pošiljaoca.';end if;
   update community_live.recovery_settings set enabled=coalesce((p_args->>'enabled')::boolean,false),sender=p_args->>'sender',mail_key_ciphertext=coalesce(nullif(p_args->>'mail_key_ciphertext',''),mail_key_ciphertext) where singleton;
   if exists(select 1 from community_live.recovery_settings where enabled and mail_key_ciphertext is null) then raise exception 'Nedostaje ključ za slanje mejla.';end if;
  end if;
  select * into s from community_live.recovery_settings where singleton;
  return jsonb_build_object('enabled',s.enabled,'sender',s.sender,'mail_configured',s.mail_key_ciphertext is not null);
 end if;
 if p_action='runtime' then
  select * into s from community_live.recovery_settings where singleton;
  select * into c from community_live.security_settings where singleton;
  return jsonb_build_object('enabled',s.enabled and s.mail_key_ciphertext is not null and c.captcha_secret_ciphertext is not null,'owner_uid',(select user_id from community_live.admins),'sender',s.sender,'mail_key_ciphertext',s.mail_key_ciphertext,'captcha_secret_ciphertext',c.captcha_secret_ciphertext,'sitekey',c.captcha_sitekey,'hostname',c.captcha_hostname);
 end if;
 raise exception 'Nepoznata radnja.';
end $$;
revoke all on function public.community_live_recovery_settings(text,jsonb) from public,anon,authenticated;
grant execute on function public.community_live_recovery_settings(text,jsonb) to service_role;
commit;
