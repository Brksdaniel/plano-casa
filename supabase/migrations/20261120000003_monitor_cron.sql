-- Etapa 3: agenda o monitoramento de hora em hora (minuto 7).
-- Os valores ficam no Vault (criptografados) e NÃO estão neste arquivo:
--   tracker_monitor_url  → https://<domínio>/api/cron/monitor
--   tracker_cron_secret  → mesmo valor de CRON_SECRET na Vercel
-- Para criar/atualizar: select vault.create_secret('<valor>', '<nome>');
--                    ou select vault.update_secret(<id>, '<valor>');

select cron.unschedule(jobid) from cron.job where jobname = 'tracker-monitor-hourly';

select cron.schedule(
  'tracker-monitor-hourly',
  '7 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'tracker_monitor_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'tracker_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
