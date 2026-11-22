# DENIELS HOME TRACKER

Sistema privado para acompanhar anúncios de aluguel cadastrados por link: preço, disponibilidade, histórico, indicador de oportunidade e avisos.

- **Site:** https://web-two-pi-26.vercel.app
- **Guia de uso e configuração:** [docs/GUIA.md](docs/GUIA.md)
- **Documento de design:** [docs/superpowers/specs/2026-11-20-deniels-home-tracker-design.md](docs/superpowers/specs/2026-11-20-deniels-home-tracker-design.md)

Stack: Next.js 16 · TypeScript · Tailwind · shadcn/ui · Supabase (Auth, Postgres, RLS, pg_cron) · Vercel · Recharts · Resend · Extensão Chrome MV3.

```
npm install
npm run dev -w web        # http://localhost:3000
npm test --workspaces     # testes
npm run build -w extension
```
