-- ═══════════════════════════════════════════════════════════
-- 08 — Usuários de cargo do app REFRIGERAÇÃO (@pmoc.local)
-- O app refrigeracao/index.html loga com estes e-mails; o script 03
-- só criou os @cmasm.local (app máquinas). Senha inicial: cmasm2026
-- ⚠ TROQUE a senha antes de usar em produção
-- Rodar no SQL Editor do Supabase.
-- ═══════════════════════════════════════════════════════════
do $$
declare v_id uuid; v_rec record;
begin
  for v_rec in select * from (values
      ('gestor@pmoc.local',  'Gestor',       'gestor',  'Gestor'),
      ('fiscal@pmoc.local',  'Fiscal',       'fiscal',  'Fiscal'),
      ('tecnico@pmoc.local', 'Técnico',      'tecnico', 'Técnico'),
      ('rlp@pmoc.local',     'Empresa RLP',  'empresa', 'Empresa RLP'),
      ('wins@pmoc.local',    'Empresa WINS', 'empresa', 'Empresa WINS')
    ) as t(email,nome,role,funcao)
  loop
    if exists (select 1 from auth.users where email=v_rec.email) then continue; end if;
    v_id := gen_random_uuid();
    insert into auth.users (instance_id,id,aud,role,email,encrypted_password,
      email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,
      confirmation_token,recovery_token,email_change_token_new,email_change)
    values ('00000000-0000-0000-0000-000000000000',v_id,'authenticated','authenticated',
      v_rec.email, crypt('cmasm2026', gen_salt('bf')), now(),now(),now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nome',v_rec.nome),'','','','');
    insert into auth.identities (id,user_id,provider_id,identity_data,provider,
      last_sign_in_at,created_at,updated_at)
    values (gen_random_uuid(),v_id,v_id::text,
      jsonb_build_object('sub',v_id::text,'email',v_rec.email,'email_verified',true),
      'email',now(),now(),now());
  end loop;
end $$;

-- ajusta role/função dos perfis criados pelo trigger
update usuarios p set role=m.role, funcao=m.funcao, nome=m.nome
from auth.users u join (values
  ('gestor@pmoc.local',  'Gestor',       'gestor',  'Gestor'),
  ('fiscal@pmoc.local',  'Fiscal',       'fiscal',  'Fiscal'),
  ('tecnico@pmoc.local', 'Técnico',      'tecnico', 'Técnico'),
  ('rlp@pmoc.local',     'Empresa RLP',  'empresa', 'Empresa RLP'),
  ('wins@pmoc.local',    'Empresa WINS', 'empresa', 'Empresa WINS')
) as m(email,nome,role,funcao) on m.email=u.email
where p.auth_id=u.id;
