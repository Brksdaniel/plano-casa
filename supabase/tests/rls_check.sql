-- Verificação de segurança do schema tracker.
-- Roda tudo num bloco que SEMPRE termina com exceção: assim nada é gravado
-- (rollback automático) e o resultado volta na mensagem de erro "RESULTADOS".
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  r text := '';
  n int;
  lr numeric;
  pr numeric;
begin
  insert into auth.users (id, email, aud, role) values
    (a, 'rls-a-' || a || '@teste.invalid', 'authenticated', 'authenticated'),
    (b, 'rls-b-' || b || '@teste.invalid', 'authenticated', 'authenticated');

  -- gatilho criou profile + preferências
  select count(*) into n from tracker.profiles where id = a;
  r := r || format('profile_criado=%s; ', case when n = 1 then 'ok' else 'FALHOU' end);
  select count(*) into n from tracker.user_preferences where user_id = a;
  r := r || format('prefs_criadas=%s; ', case when n = 1 then 'ok' else 'FALHOU' end);

  insert into tracker.apartments (user_id, url_original, url_normalized, platform, rent, condo_fee, iptu)
    values (a, 'https://x.test/1', 'x.test/1', 'generic', 2000, 500, 100),
           (b, 'https://x.test/2', 'x.test/2', 'generic', 1500, null, null);

  insert into tracker.apartment_price_history (user_id, apartment_id, rent, source, recorded_at)
    select user_id, id, 1800, 'server', now() - interval '2 day' from tracker.apartments where user_id in (a, b);
  insert into tracker.apartment_price_history (user_id, apartment_id, rent, source)
    select user_id, id, rent, 'server' from tracker.apartments where user_id in (a, b);

  select total_monthly into n from tracker.apartments where user_id = a;
  r := r || format('total_mensal=%s; ', case when n = 2600 then 'ok' else 'FALHOU' end);

  -- duplicidade
  begin
    insert into tracker.apartments (user_id, url_original, url_normalized, platform)
      values (a, 'https://x.test/1?utm=1', 'x.test/1', 'generic');
    r := r || 'duplicado_bloqueado=FALHOU; ';
  exception when unique_violation then
    r := r || 'duplicado_bloqueado=ok; ';
  end;

  -- usuário A autenticado
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from tracker.apartments;
  r := r || format('a_ve_so_o_seu=%s; ', case when n = 1 then 'ok' else 'FALHOU(' || n || ')' end);
  select count(*) into n from tracker.profiles;
  r := r || format('a_ve_so_seu_profile=%s; ', case when n = 1 then 'ok' else 'FALHOU(' || n || ')' end);

  begin
    insert into tracker.apartments (user_id, url_original, url_normalized, platform)
      values (b, 'https://x.test/3', 'x.test/3', 'generic');
    r := r || 'a_nao_grava_para_b=FALHOU; ';
  exception when insufficient_privilege or check_violation then
    r := r || 'a_nao_grava_para_b=ok; ';
  end;

  -- tendência de preço (view com security_invoker): A só vê a dele
  select count(*) into n from tracker.apartment_price_trend;
  r := r || format('a_ve_so_sua_tendencia=%s; ', case when n = 1 then 'ok' else 'FALHOU(' || n || ')' end);

  select latest_rent, previous_rent into lr, pr from tracker.apartment_price_trend;
  r := r || format('tendencia_valores=%s; ', case when lr = 2000 and pr = 1800 then 'ok' else 'FALHOU(' || lr || '/' || pr || ')' end);

  update tracker.apartments set rent = 1 where user_id = b;
  get diagnostics n = row_count;
  r := r || format('a_nao_altera_b=%s; ', case when n = 0 then 'ok' else 'FALHOU' end);

  execute 'reset role';

  -- anônimo
  execute 'set local role anon';
  begin
    select count(*) into n from tracker.apartments;
    r := r || 'anon_bloqueado=FALHOU; ';
  exception when insufficient_privilege then
    r := r || 'anon_bloqueado=ok; ';
  end;
  begin
    select count(*) into n from tracker.apartment_price_trend;
    r := r || 'anon_tendencia_bloqueada=FALHOU; ';
  exception when insufficient_privilege then
    r := r || 'anon_tendencia_bloqueada=ok; ';
  end;
  execute 'reset role';

  raise exception 'RESULTADOS: %', r;
end $$;
