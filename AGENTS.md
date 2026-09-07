# Project Rules — Always-On

This file is read automatically at the start of every Antigravity session.
Full detail lives in `docs/context/` — read the relevant file before
implementing any batch (don't rely on this summary alone for anything
non-trivial).

- `docs/context/00-SYSTEM_CONTEXT.md` — architecture, principles, entities, backend reference
- `docs/context/API_SPECIFICATION.md` — every backend route, request/response shape, error codes
- `docs/context/AUTH_SPECIFICATION.md` — auth flows, session handling, Security Doctrine
- `prisma/schema.prisma` — database schema (read-only reference, lives in the frontend repo for type generation)
- `api_contracts/` — exact `.http` request/response examples for every backend endpoint
- `docs/PROMPT_PACK.md` — the batch-by-batch build plan; work through it in order

## What This Project Is

This is the **frontend** for the HobbyHub platform. It consists of:

1. **Admin Dashboard** — A Next.js (App Router) web app using shadcn/ui components, React Query for data fetching, and Sonner for toasts. Used by community owners/admins/moderators for management tasks.
2. **React Native Mobile App** — A separate Expo-based repo. (See `PROMPT_PACK.md` Part C.)

The **backend** is a separate NestJS codebase built by a teammate. It is already complete, tested, and deployed. We do NOT modify it. We only call its REST API at `{NEXT_PUBLIC_API_URL}/api/v1/*`.

## Stack

- **Admin Dashboard:** Next.js (App Router), TypeScript, shadcn/ui, React Query (`@tanstack/react-query`), Sonner (toasts), react-hook-form + zod (form validation)
- **Backend (read-only):** NestJS 10.4, Prisma 5.22.0, PostgreSQL 16, Zod, CASL, bcrypt, session-based bearer tokens
- **Schema reference:** `prisma/schema.prisma` lives in this repo for type reference and potential Prisma Client generation (read-only — we never run migrations from the frontend)
- **API contracts:** `api_contracts/` directory contains `.http` files showing exact request/response payloads for every endpoint

## Key files and directories

```
.
├── AGENTS.md                            ← this file (project root)
├── docs/
│   ├── context/
│   │   ├── 00-SYSTEM_CONTEXT.md         ← architecture, entities, backend reference
│   │   ├── API_SPECIFICATION.md         ← endpoint catalog for frontend consumption
│   │   └── AUTH_SPECIFICATION.md        ← auth integration guide
│   └── PROMPT_PACK.md                   ← batch-by-batch build plan
├── prisma/
│   └── schema.prisma                    ← database schema (read-only reference)
├── api_contracts/                       ← .http files with exact request/response examples
│   ├── auth/auth.http
│   ├── communities/communities.http
│   ├── posts/posts.http
│   ├── comments/comments.http
│   ├── events/events.http
│   ├── hangouts/hangouts.http
│   ├── reports/reports.http
│   ├── social/social.http
│   ├── admin/admin.http
│   ├── users/users.http
│   └── health/health.http
├── src/                                 ← Next.js application source
├── package.json
└── ...
```

## Non-negotiable rules for every page/component

1. **Use ONLY shadcn/ui components** for the admin dashboard. Install with
   `npx shadcn@latest add <component>`. No custom component libraries, no
   Material UI, no Chakra, no Ant Design.
2. **React Query for ALL data fetching.** No raw `useEffect` + `fetch` patterns.
   Configure `staleTime: 5 * 60 * 1000` (5 min), no retry on 401/403.
3. **Sonner for all toasts** — success, error, info notifications.
4. **react-hook-form + zod for all forms.** Client-side validation mirrors
   backend Zod schemas for instant feedback, but the backend is the authority.
5. **API client module** (`src/lib/api-client.ts`) reads `bearer_token` from
   `localStorage`, attaches `Authorization: Bearer <token>` to every request.
   On 401 from ANY endpoint: clear token, redirect to `/login`.
6. **Standard response envelope handling:** Every API response is
   `{ success, data, meta?, error? }`. Check `success` first. If `false`,
   read `error.code` and react:
   - `UNAUTHORIZED` (401) → clear token, redirect to login
   - `FORBIDDEN` (403) → show "Access Denied"
   - `VALIDATION_ERROR` (400) → show field-level errors from `error.details`
   - `CONFLICT` (409) → show specific conflict message
   - `NOT_FOUND` (404) → show "Not Found"
7. **The backend wraps ALL responses** in `{ success: true, data: ... }` via
   its `TransformResponseInterceptor`. The actual data you need is always
   inside `response.data.data` (Axios) or `response.data` (after your
   api-client unwraps the envelope).
8. **Skeleton loading states** on every page that fetches data. Use shadcn's
   `Skeleton` component.
9. **Empty states** on every list page — meaningful messages, not blank screens.
10. **Handle all auth states:** loading (skeleton), authenticated (show page),
    unauthenticated (redirect to login), unauthorized (show "Access Denied").

## The frontend is never a security boundary

The Admin Dashboard's login page is the same `POST /api/v1/auth/login` the
mobile app uses — any registered user can hit it. That's fine: every backend
endpoint independently re-verifies the caller's role before returning data or
allowing an action. Don't try to "protect" routes by hiding UI — protect them
by letting the backend return 403, and handle it gracefully.

## Do not touch the backend

The backend is a separate NestJS codebase. Do NOT:
- Modify any backend file
- Create API route handlers in the Next.js app (no `/app/api/` routes)
- Attempt to run backend commands (migrations, seeds) from this project
- Make assumptions about backend internals beyond what's documented in
  `api_contracts/` and the context docs

## Style

- TypeScript, App Router conventions, named exports over default exports.
- Match the exact error codes and response shapes in
  `docs/context/API_SPECIFICATION.md` §2 — don't invent new ones.
- When a batch says "reuse X component or hook," reuse it — don't write a
  parallel implementation that does the same thing slightly differently.
- Category is locked, always. If any AI session tries to add a "change
  category" feature anywhere (UI, form, settings page), stop it — this was
  a deliberate, confirmed v1 decision.
- Owner protection: owner cannot be demoted, kicked, or leave without
  transferring ownership. Disable/hide those controls for the owner row.
