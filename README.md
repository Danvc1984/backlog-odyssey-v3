# Backlog Odyssey

Private, single-user gaming library and decision assistant for a fixed setup:
Bazzite on desktop, Steam Deck as the portable option, and Windows as fallback.
It combines a Steam-centered library, manually added games and ROMs, a local
wishlist, regional prices, compatibility evidence, and explainable
play-next / buy recommendations.

## Stack

- [Next.js](https://nextjs.org) App Router (TypeScript, Turbopack, Tailwind v4)
- [shadcn/ui](https://ui.shadcn.com) on Radix UI
- [Prisma](https://www.prisma.io) + PostgreSQL on Supabase
- [Auth.js](https://authjs.dev) with Google (single allowed email)
- Vitest for tests

See `blueprint/README.md` for the development workflow.

## Commands

- Dev server: `pnpm dev` (http://localhost:3000)
- Build: `pnpm build`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Unit tests: `pnpm test`
- Prisma migrate (dev): `pnpm prisma:migrate`
- Prisma DB seed: `pnpm db:seed`
- Prisma Studio: `pnpm prisma:studio`

## Getting started

1. `cp .env.example .env` and fill in `DIRECT_URL`, `DATABASE_URL`, Google
   credentials, and `ALLOWED_GOOGLE_EMAIL`.
2. `pnpm install`
3. `pnpm prisma:migrate` then `pnpm db:seed`
4. `pnpm dev`