# HobbyHub — Complete Prompt Pack for All Frontend Chats
> **Version:** 3.0 (Frontend-Only — all prompts target building the admin dashboard and mobile app against the existing NestJS backend)
> **Purpose:** One batch prompt per Antigravity task. Reference by path, paste in full when you want precise control.
> **Note:** There are NO backend/API batch prompts in this file. The backend is already built and tested. This prompt pack covers only the two frontend consumers: the admin dashboard (Next.js + shadcn/ui) and the React Native mobile app (Expo).

---

## CONTEXT THE AGENT NEEDS (For EVERY Chat)

These already live in the repo, and `AGENTS.md` at the project root points to them — you don't attach them, the agent reads them itself:

1. `docs/context/00-SYSTEM_CONTEXT.md`
2. `docs/context/API_SPECIFICATION.md`
3. `docs/context/AUTH_SPECIFICATION.md`
4. `prisma/schema.prisma` (database schema — read-only reference)
5. `api_contracts/` (folder of `.http` files with exact request/response examples)

For **dashboard chats**, point it at the relevant section of this file (Part A).

For **mobile app chats**, same context files, plus Part B below — but remember the mobile app is a *separate* Antigravity workspace/repo, so it needs its own copy of `docs/context/`, `AGENTS.md`, `prisma/`, and `api_contracts/`.

---

## PART A: ADMIN DASHBOARD PROMPTS

**IMPORTANT:** The backend is already built and tested. The dashboard is a pure API consumer. Every prompt below builds frontend pages that call the NestJS backend at `{NEXT_PUBLIC_API_URL}/api/v1/*`.

### Security Doctrine (already in `docs/context/00-SYSTEM_CONTEXT.md` §12 and summarized in `AGENTS.md` — reference it, don't re-paste it)

The frontend cannot enforce security. The dashboard is cosmetic and navigational — it makes the API usable, it does not make the API secure. Every role/ownership check happens in the NestJS backend. The frontend only hides UI elements it thinks the user can't use (UX, not security), redirects to `/login` on 401, and shows "Access Denied" on 403. If a user opens DevTools, sets `isAdmin: true` in local state, and clicks "Delete Community," the backend must return 403 regardless.

### DASHBOARD CHAT 1: Layout + Sidebar + API Client

```
I am building an admin dashboard for a community platform. The backend is already built
(NestJS 10 + Prisma + PostgreSQL) — I do NOT need to build any API routes. Before writing
any code, read docs/context/00-SYSTEM_CONTEXT.md, docs/context/API_SPECIFICATION.md,
docs/context/AUTH_SPECIFICATION.md, and the api_contracts/ directory for exact
request/response shapes.

Today I need to build the foundation: layout, sidebar navigation, and API client.

Build these files:
1. src/lib/api-client.ts — Axios instance with baseURL from process.env.NEXT_PUBLIC_API_URL
   + '/api/v1'. Request interceptor reads bearer_token from localStorage, attaches
   Authorization header. Response interceptor: on 401 clear token and redirect to /login,
   on success unwrap the { success, data, meta } envelope and return data (and meta if
   present). Export typed helper functions: apiGet, apiPost, apiPatch, apiDelete.
2. src/lib/query-client.ts — React Query client (staleTime 5 min, no retry on 401/403).
3. src/app/providers.tsx — QueryClientProvider wrapper.
4. src/app/(dashboard)/layout.tsx — shadcn Sidebar (persistent desktop, Sheet drawer
   mobile), breadcrumb, header with avatar + logout. Nav groups: "Dashboard" (home),
   "My Communities" (dynamic, from GET /api/v1/users/me/communities), "Community
   Management" (Overview, Members, Posts, Events, Reports, Settings — shown inside a
   community context, navigated to via clicking a community).
5. src/app/(auth)/login/page.tsx — shadcn Card/Input/Button/Label/Form. Calls
   POST /api/v1/auth/login with { identifier, password } (NOT { email, password } —
   the field is a single "email or phone" identifier per AUTH_SPECIFICATION.md §3).
   Stores token in localStorage as 'bearer_token', redirects to / on success.

Requirements:
- Use ONLY shadcn/ui components. Install with npx shadcn@latest add <component>.
- Sonner for toasts.
- Responsive: sidebar collapses via Sheet on mobile.
- Do NOT create any API route handlers (no /app/api/ directory). This is a frontend-only
  project consuming an external NestJS backend.
- The base URL for all API calls is {NEXT_PUBLIC_API_URL}/api/v1 — the backend returns
  responses wrapped in { success: true, data: { ... } } via its TransformResponseInterceptor.

Write the complete code for all files.
```

### DASHBOARD CHAT 2: Dashboard Home ("My Communities")

```
[Same context-reading preamble as Chat 1]

Today I need to build the Dashboard Home page.

Build: src/app/(dashboard)/page.tsx — fetch GET /api/v1/users/me/communities via React
Query. Grid of shadcn Cards: community name, slug, profile picture, member count, role
badge (Owner/Admin/Moderator — use the 'role' field from the response, note that 'owner'
is derived from creator_id by the backend and included as the role value), "Manage"
button → /communities/[slug]. Skeleton loading state.
Empty state: "You don't manage any communities yet."

Reference response shape from api_contracts/users/users.http @GetMyManagedCommunities.

Requirements:
- shadcn card, badge, button, skeleton, alert only.
- Handle 401 (redirect to login), 403, loading, empty states.
- Sonner for toasts on errors.

Write the complete code for this page.
```

### DASHBOARD CHAT 3: Community Overview

```
[Same context-reading preamble]

Build: src/app/(dashboard)/communities/[slug]/page.tsx — fetch
GET /api/v1/admin/communities/:slug and GET /api/v1/admin/communities/:slug/stats.

Display:
- Community header: name, description, category badge (read-only), privacy badge
- 6 stat cards: Total Members, Total Posts, Total Events, Pending Reports, Pending Events,
  New Members This Week (from the stats endpoint — see api_contracts/admin/admin.http)
- Show the user's role in this community (from the 'myRole' field in the overview response)

Skeleton loading. 403 → "Access Denied" page (show message, link back to home).

Reference response shapes:
- api_contracts/admin/admin.http @GetCommunityOverview (response includes community object,
  myRole, and memberCount)
- api_contracts/admin/admin.http @GetCommunityStats (response includes totalMembers,
  totalPosts, totalEvents, pendingReports, pendingEvents, newMembersThisWeek)

Requirements: shadcn card, badge, skeleton, alert, tabs (optional). React Query. Sonner.

Write the complete code for this page.
```

### DASHBOARD CHAT 4: Members Page

```
[Same context-reading preamble]

Build: src/app/(dashboard)/communities/[slug]/members/page.tsx — Data Table pattern.

Columns: Avatar+Username, Name (first_name + last_name), Role (select dropdown if current
user is owner; else read-only badge), Joined At, Actions (Kick button — alert-dialog
confirmation, disabled for the owner row).

Data: Fetch GET /api/v1/communities/:slug/members?page=1&limit=20 (supports ?role filter).
Reference api_contracts/communities/communities.http @ListCommunityMembers for response shape.

Mutations:
- PATCH /api/v1/communities/:slug/members/:userId with { role: 'member' | 'moderator' | 'admin' }
  (owner only — reference @UpdateMemberRole)
- DELETE /api/v1/communities/:slug/members/:userId/kick (reference @KickMember)

CRITICAL rules:
- The kick endpoint has a /kick suffix — DELETE .../members/:userId/kick, NOT DELETE .../members/:userId.
- Owner row (the user whose id === community.creator_id, or whose role is 'owner' in the members list)
  must have the kick button disabled and the role select disabled/hidden.
- The role dropdown should only appear if the current user's role is 'owner' for this community.
- Backend returns 400 if you try to alter the owner's role or kick the owner — handle gracefully.

Search/filter bar. Pagination. Skeleton loading.

Requirements: shadcn table/select/alert-dialog/avatar/skeleton/badge/input. React Query. Sonner.

Write the complete code for this page.
```

### DASHBOARD CHAT 5: Events Page

```
[Same context-reading preamble]

Build: src/app/(dashboard)/communities/[slug]/events/page.tsx — Tabs: "Upcoming Events"
and "Pending Proposals".

Tab 1 — Upcoming Events:
- Fetch GET /api/v1/communities/:slug/events?page=1&limit=20 (reference api_contracts/events/events.http)
- Columns: Title, Date (startsAt), Visibility, Participants Count, Status, Actions (Edit, Delete)
- Edit opens a dialog with the event details pre-filled, submits PATCH .../events/:id
- Delete → soft delete via DELETE .../events/:id (alert-dialog confirmation)

Tab 2 — Pending Proposals:
- Fetch GET /api/v1/admin/communities/:slug/pending-events (reference api_contracts/admin/admin.http)
- Columns: Title, Proposed By, Date, Actions (Approve, Reject, View)
- Approve → POST .../events/:id/approve (reference api_contracts/events/events.http @ApproveEvent)
- Reject → POST .../events/:id/reject with optional { reason } (reference @RejectEvent)

Create Event dialog:
- react-hook-form + zod
- Fields: title, description, coverImageUrl, startsAt (date picker), endsAt (date picker),
  visibility (select: public/community/subcommunity), maxParticipants
- Submit → POST /api/v1/communities/:slug/events
- The backend auto-sets approvalStatus='approved' + isVerified=true for admin/mod/owner creators

Skeleton loading, empty states for both tabs.

Requirements: shadcn tabs/table/dialog/form/calendar/popover/select/alert-dialog. React Query. Sonner.

Write the complete code for this page.
```

### DASHBOARD CHAT 6: Reports Page

```
[Same context-reading preamble]

Build: src/app/(dashboard)/communities/[slug]/reports/page.tsx

Data: Fetch GET /api/v1/communities/:slug/reports?page=1&limit=20
Reference api_contracts/reports/reports.http for all response shapes.

Table columns: Reporter, Target Type (user/post/comment/event/hangout — derived from which
reported_*_id field is non-null), Reason, Status badge (pending/reviewing/resolved/dismissed),
Created At, Actions.

Actions column:
- "Review" button → opens a dialog with:
  - Status update dropdown (pending → reviewing → resolved/dismissed) →
    PATCH /api/v1/reports/:id with { status }
  - Moderation action form: actionType select (warn/suspend/ban/unban/content_removed/
    content_restored), notes textarea →
    POST /api/v1/reports/:id/action with { actionType, notes? }
    (reference api_contracts/reports/reports.http @TakeModerationAction)

Status filter tabs or dropdown filter. Pagination. Skeleton loading.

Also add:
- GET /api/v1/communities/:slug/moderation-actions — show in a secondary tab or
  expandable section (moderation action history)
- GET /api/v1/admin/communities/:slug/banned-users — show in a "Banned Users" tab

Requirements: shadcn table/dialog/form/select/textarea/tabs/badge. React Query. Sonner.

Write the complete code for this page.
```

### DASHBOARD CHAT 7: Posts Page

```
[Same context-reading preamble]

Build: src/app/(dashboard)/communities/[slug]/posts/page.tsx

Data: Fetch GET /api/v1/communities/:slug/posts?page=1&limit=20
Reference api_contracts/posts/posts.http for response shapes.

Tabs: "Active" (deleted_at=null) / "Removed" (if the backend supports filtering by
deleted status — otherwise just show active posts).

Columns: Author (avatar + username), Title, Date (createdAt), Reactions (reactionCount),
Comments (commentCount), Tags, Actions.

Actions:
- "View" → dialog showing full post content
- "Remove" → DELETE /api/v1/posts/:id (soft delete, alert-dialog confirmation)
  Only show for admin/mod/owner of this community.

Pagination. Search filter (by title). Skeleton loading. Empty state.

Requirements: shadcn tabs/table/dialog/alert-dialog/badge/avatar. React Query. Sonner.

Write the complete code for this page.
```

### DASHBOARD CHAT 8: Settings Page

```
[Same context-reading preamble]

Build: src/app/(dashboard)/communities/[slug]/settings/page.tsx — owner-only page.

Form (react-hook-form + zod):
- Name (editable)
- Description (textarea, editable)
- Rules (textarea, editable)
- Banner URL (editable)
- Profile Picture URL (editable)
- Is Private (switch, editable)
- Category: **READ-ONLY**, disabled input with a tooltip explaining category cannot be
  changed after creation (confirmed v1 decision — do NOT build an edit path for it)
- Slug: **READ-ONLY**, disabled input

Submit → PATCH /api/v1/communities/:slug
Reference api_contracts/communities/communities.http @UpdateCommunity for request/response.

Danger Zone card (below the form):
- "Delete Community" button (AlertDialog with "Are you sure? This action is irreversible.")
  → DELETE /api/v1/communities/:slug (reference @DeleteCommunity)
  Only the owner can see this section.

If current user is NOT the owner → show "Owner access only. You can view community
settings but cannot modify them." and disable all form fields.

403 from the backend → "Access Denied" message.

Requirements: react-hook-form + zod. shadcn form/switch/alert-dialog/input/textarea/
tooltip/card. Sonner.

Write the complete code for this page.
```

### DASHBOARD CHAT 9 (Bonus): Notifications + Final Polish

```
[Same context-reading preamble]

Build:
1. Notifications dropdown in the dashboard header — bell icon, unread count badge,
   last 5 unread notifications via GET /api/v1/notifications?unreadOnly=true&limit=5.
   Each notification shows: type icon, title, message, time ago. Click → mark as read
   via PATCH /api/v1/notifications/:id/read. "View all" link → notifications page.
   Reference api_contracts/social/social.http @ListNotifications and @MarkNotificationRead.

2. Full notifications page at src/app/(dashboard)/notifications/page.tsx — all
   notifications with pagination, mark individual as read, "Mark all as read" button
   (batch PATCH calls). Filter: all / unread only.

3. Breadcrumbs on all sub-pages (communities/[slug]/members, /events, /reports, /posts,
   /settings).

4. Verify mobile responsiveness across every page built in Chats 1–8. Fix any layout
   issues — sidebar must collapse into Sheet on mobile, tables must be horizontally
   scrollable, dialogs must be usable on small screens.

Requirements: shadcn dropdown-menu/popover/card/badge/breadcrumb. Sonner.

Write the complete code.
```

---

## PART B: REACT NATIVE MOBILE APP PROMPTS

**IMPORTANT:** Do not start these until the dashboard (Part A) is complete. The mobile app is the second API consumer, same rules as the dashboard: it enforces nothing, it only reflects what the backend allows.

**Setup (do this once, outside a chat):**
```bash
npx create-expo-app hobbyhub-mobile
cd hobbyhub-mobile
npm install @tanstack/react-query axios zustand @react-navigation/native @react-navigation/native-stack expo-secure-store expo-location
```

Copy all context files into this new project (same layout as Part 3 of `DEVELOPMENT_WORKFLOW.md`).

Use `expo-secure-store` for the bearer token on mobile (not AsyncStorage) — same "never store the token in a way that leaks" principle as the dashboard, adapted to native storage.

### MOBILE CHAT 1: API Client + Auth Screens

```
I am building the React Native mobile app for a community platform (second API consumer,
after the admin dashboard). The backend is already built (NestJS 10 + Prisma + PostgreSQL)
— I do NOT need to build any API routes. Before writing any code, read
docs/context/00-SYSTEM_CONTEXT.md, docs/context/API_SPECIFICATION.md,
docs/context/AUTH_SPECIFICATION.md, and the api_contracts/ directory for exact
request/response shapes.

Today I need to build the API client and auth screens.

Build:
1. src/api/client.ts — Axios instance with baseURL from an env var (EXPO_PUBLIC_API_URL)
   + '/api/v1'. Request interceptor reads bearer token from expo-secure-store, attaches
   Authorization header. Response interceptor: on 401 clear token and navigate to Login,
   on success unwrap the { success, data, meta } envelope. Export typed helpers.
2. src/stores/authStore.ts — Zustand store: { user, token, isLoggedIn, login, logout,
   hydrate }. hydrate() reads the token from SecureStore on app boot, validates with
   GET /api/v1/users/me, sets user if valid.
3. src/screens/LoginScreen.tsx — email-OR-phone identifier field + password field,
   calling POST /api/v1/auth/login with { identifier, password } per
   AUTH_SPECIFICATION.md §3. Also a "Continue with Google" and "Continue with Telegram"
   button (Telegram per AUTH_SPECIFICATION.md §6 — Telegram Login Widget flow adapted
   to a WebView-based OAuth redirect, same pattern as Google's).
4. src/screens/RegisterScreen.tsx — username, first/last name, birth date picker, and
   EITHER an email field OR a phone field (a toggle/segmented control lets the user pick
   which one to provide — do not require both). Password field. Calls
   POST /api/v1/auth/register. Reference api_contracts/auth/auth.http @Register.
5. src/navigation/AuthNavigator.tsx — stack navigator wrapping Login/Register, shown
   when !isLoggedIn.

Requirements:
- Use React Navigation native-stack.
- Token in expo-secure-store, not AsyncStorage.
- Match the response envelope in API_SPECIFICATION.md §2 exactly — the backend wraps
  all responses in { success, data, meta }.
- Do NOT build any bot-related UI — Telegram is login-only in v1.

Write the complete code for all files.
```

### MOBILE CHAT 2: Discovery — Home, Communities List, Community Detail

```
[Same context-reading preamble]

Today I need to build the discovery screens.

Build:
1. src/screens/HomeScreen.tsx — feed combining nearby communities and upcoming events/
   hangouts (use device location via expo-location; fall back to a manual location
   picker if permission denied). Calls GET /api/v1/communities?page=1&limit=10 and
   GET /api/v1/hangouts?page=1&limit=10.
2. src/screens/CommunitiesScreen.tsx — searchable/filterable list (category filter,
   text search via ?q=) using GET /api/v1/communities. Reference
   api_contracts/communities/communities.http @ListCommunities.
3. src/screens/CommunityDetailScreen.tsx — community header (name, description, banner,
   category badge), Join/Leave button (POST .../join, POST .../leave — reference
   @JoinCommunity and @LeaveCommunity), tabs for Posts/Events/Hangouts.
   If the current user is owner/admin/moderator of THIS community (check against
   GET /api/v1/users/me/communities), show a "Manage" button.

The "Manage" button is the owner/admin "switch" described in 00-SYSTEM_CONTEXT.md §2.4:
in v1 it opens a WebView pointed at the Admin Dashboard's URL for this community
(`{DASHBOARD_BASE_URL}/communities/{slug}`), passing the current bearer token via a
short-lived query param so the dashboard can pick it up and store it in its own
localStorage on load. It does NOT reimplement any dashboard screen natively. Only show
this button for communities returned by GET /api/v1/users/me/communities — do not
compute "is manager" from any other signal.

Requirements: React Query for all data fetching. Respect visibility/soft-delete/blocks
per the feed rules the backend enforces (the frontend trusts backend responses).

Write the complete code for all three screens.
```

### MOBILE CHAT 3: Content — Posts, Comments, Create Post

```
[Same context-reading preamble]

Build:
1. src/screens/PostDetailScreen.tsx — full post display (title, content, media, author
   with avatar, tags, createdAt) + comments list with reply threading via
   parentCommentId (2-level: top-level comments with their direct replies).
   React button (like toggle via POST /api/v1/posts/:id/react — reference
   api_contracts/posts/posts.http @ToggleReaction). Save button (POST .../save).
   Comment input at bottom → POST /api/v1/posts/:postId/comments.
   Reply button on each comment → opens inline reply input with parentCommentId set.

2. src/screens/CreatePostScreen.tsx — form with title (optional), content (optional),
   media picker (optional, shows preview), tag input (comma-separated or chip input).
   At least one of title/content/media required. Submit → POST
   /api/v1/communities/:slug/posts. Reference api_contracts/posts/posts.http @CreatePost.

3. src/components/PostCard.tsx — reusable card component for feeds. Shows: author
   avatar + username, title, content preview, media thumbnail, tags, reaction count +
   hasReacted indicator, comment count, save indicator. Tap → PostDetailScreen.

Wire to: GET /api/v1/communities/:slug/posts (list), GET /api/v1/posts/:id (detail),
POST/PATCH/DELETE /api/v1/posts/:id, POST .../react, POST .../save,
GET /api/v1/posts/:postId/comments (list), POST .../comments (create),
PATCH/DELETE /api/v1/comments/:id.

Requirements: React Query with optimistic updates for react/save toggles. Respect
soft-delete and block rules (trust backend responses).

Write the complete code.
```

### MOBILE CHAT 4: Events + Hangouts

```
[Same context-reading preamble]

Build:
1. src/screens/EventsScreen.tsx — list of events for a community. Fetch
   GET /api/v1/communities/:slug/events. Each card shows: title, date, visibility badge,
   participants count, approval status badge. Tap → EventDetailScreen.

2. src/screens/EventDetailScreen.tsx — full event display. Join/Leave button
   (POST .../join, POST .../leave). Show "Support this idea" label when approvalStatus
   is 'proposed' (per 00-SYSTEM_CONTEXT.md §3 Events), "I will attend" when 'approved'.
   Display: creator info, participants count, isParticipant, isSaved.
   Save toggle (POST .../save). Reference api_contracts/events/events.http.

3. src/screens/HangoutsScreen.tsx — list of public hangouts. Fetch
   GET /api/v1/hangouts?page=1&limit=20. Each card: title, date, joinType badge
   (open/request_based), participants count. Tap → HangoutDetailScreen.

4. src/screens/HangoutDetailScreen.tsx — full hangout display. Open hangouts: Join/Leave
   buttons. Request-based hangouts: "Request to Join" button (POST .../request). If
   user is the creator, show pending join requests (from the hangout detail response)
   with Approve/Reject buttons (PATCH .../requests/:userId with { status }).
   Reference api_contracts/hangouts/hangouts.http.

5. src/screens/CreateHangoutScreen.tsx — form: title, description, startsAt (date picker),
   endsAt (date picker), visibility (select), joinType (select: open/request_based),
   maxParticipants, communityId (optional — if omitted, standalone hangout).
   Submit → POST /api/v1/hangouts.

Requirements: React Query. Respect visibility scopes and bans (the backend filters these —
the frontend trusts what's returned). Reference api_contracts/ for exact response shapes.

Write the complete code.
```

### MOBILE CHAT 5: Social + Profile + Notifications

```
[Same context-reading preamble]

Build:
1. src/screens/ProfileScreen.tsx — works for both own profile (GET /api/v1/users/me)
   and other users' profiles (GET /api/v1/users/:id). Shows: avatar, username, name,
   bio, trust score badge (tier label only — "Trusted"/"Member"/"New", never the raw
   number, per 00-SYSTEM_CONTEXT.md §4), created date, stats (followersCount,
   followingCount, communitiesCount from the response).
   Own profile: Edit button → EditProfileScreen.
   Other profile: Follow/Unfollow button (POST/DELETE /api/v1/users/:id/follow),
   Block button (POST/DELETE /api/v1/users/:id/block).
   Trust score from GET /api/v1/users/:id/trust-score.
   Reference api_contracts/social/social.http.

2. src/screens/EditProfileScreen.tsx — form with: firstName, lastName, bio,
   profilePictureUrl (image picker), phoneNumber (note: changing it resets verification).
   Submit → PATCH /api/v1/users/me. Reference api_contracts/users/users.http @UpdateMyProfile.

3. src/screens/NotificationsScreen.tsx — list of notifications via
   GET /api/v1/notifications?page=1&limit=20. Each item: type icon, title, message,
   time ago, read/unread indicator. Tap → mark as read (PATCH .../notifications/:id/read)
   and navigate to related entity if applicable. "Mark all as read" button.

4. src/screens/SavedItemsScreen.tsx — tabs: Saved Posts, Saved Events, Saved Hangouts.
   (Note: the backend may not have dedicated "list saved items" endpoints in v1 —
   if not available, show a placeholder "Coming soon" for now, or use the hasSaved/
   isSaved flags in feed items to build a client-side saved list.)

Requirements: React Query. Trust score badge shows tier label only, never the raw number.

Write the complete code.
```

---

## PART C: Quick Reference — What Each Chat Reads

| Chat | Files the agent should read |
|---|---|
| Dashboard Chats 1–9 | `docs/context/00-SYSTEM_CONTEXT.md`, `docs/context/API_SPECIFICATION.md`, `docs/context/AUTH_SPECIFICATION.md`, `prisma/schema.prisma`, `api_contracts/` (relevant `.http` file per chat) |
| Mobile Chats 1–5 | Same files — note this is a *separate* Antigravity workspace (its own repo), so it needs its own `docs/context/` copy, `AGENTS.md`, `prisma/`, and `api_contracts/` |

These live in the repo already — AGENTS.md points the agent at them, so you don't need to attach anything per chat. Just tell the agent which chat to build and, if you want to be explicit, which file to read for it.

---

## PART D: Pro Tips

1. **Reference by path, don't paste the whole prompt if you don't need to.** A short instruction like "build dashboard chat 3, using the prompt in docs/PROMPT_PACK.md for that chat" works — the agent can open this file itself. Paste the full prompt instead when you want to add something chat-specific on the fly.
2. **If an AI tries to create API route handlers (a `/app/api/` directory), stop it immediately.** Say: *"This is a frontend-only project. The backend is a separate NestJS codebase. Do NOT create any API routes. Only consume the existing backend via the API client."*
3. **If an AI doesn't use shadcn/ui components, correct it.** Say: *"Use ONLY shadcn/ui components. Install with npx shadcn@latest add \<component\>."*
4. **If an AI invents its own response shapes instead of matching the actual backend**, point it at the relevant `api_contracts/*.http` file. Say: *"Read api_contracts/posts/posts.http for the exact response shape. Don't invent your own."*
5. **Test each chat before moving to the next.** Run `npm run dev` and manually interact.
6. **Commit to git after every chat.**
7. **One chat per batch.** Long chats degrade code quality.
8. **Category is locked, always.** If any AI session tries to add a "change category" feature anywhere (settings form, dropdown, etc.), stop it — this was a deliberate, confirmed v1 decision.
9. **Owner protection, always.** If any AI session renders a kick button or role dropdown for the owner row in the members table, stop it — the owner cannot be demoted or kicked.
10. **The backend wraps ALL responses.** The actual data is inside `response.data` (after the API client unwraps the envelope). If the AI writes code that accesses `response.data.data.data`, something is wrong — it's double-unwrapping.

---

*End of prompt pack. Copy, paste, build.*
