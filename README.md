# AI Career Finder

An evidence-grounded career coach that learns a user's goals, interests,
experience, and decision history before recommending whether and how to apply
for a role.

## Current milestone

Phase 1 established the modular foundation. Phase 2 adds a working manual
Career Intelligence Profile at `/profile`, including grouped career facts,
editing, confirmation/rejection of proposed facts, server-side ownership,
Supabase persistence, and automated lifecycle tests. The visual interface is
intentionally minimal and depends only on stable application contracts.

## Local setup

Requirements:

- Node.js 20.19 or newer (Node.js 22 LTS recommended)
- A Supabase project
- An OpenAI API project and key

Copy `.env.example` to `.env.local` and fill in the server-only values. Never
expose the service-role or OpenAI keys through `NEXT_PUBLIC_` variables.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The configuration-only health response is
available at <http://localhost:3000/api/health>; it never returns secret values.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Architecture

- `src/domain`: business entities and deterministic decision rules
- `src/application`: provider-independent use cases and ports
- `src/infrastructure`: OpenAI, Supabase, and identity adapters
- `src/app`: replaceable HTTP and UI delivery layer
- `supabase`: schema migrations and storage policies

The initial fixed identity is deliberately behind an adapter. Before a public
beta, replace it with Supabase Auth without changing domain or application
services.
