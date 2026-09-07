# API Specification & Frontend Integration Reference
> **Version:** 3.0 (Frontend-Only — documents the existing NestJS backend API as consumed by the admin dashboard and mobile app)
> **Style:** RESTful JSON API
> **Base URL:** `{API_BASE_URL}/api/v1` (e.g., `http://localhost:3000/api/v1` in development)
> **Auth:** Bearer token via `Authorization: Bearer <token>` header — no cookies, ever
> **Content-Type:** `application/json`
> **Status:** ✅ Every endpoint listed below is already built, tested, and passing in the NestJS backend. The frontend consumes them — it does not build them.
> **Ground-truth for request/response shapes:** The `.http` files in `api_contracts/` contain exact example payloads. When in doubt, reference those files over this summary.

---

## 0. Role-Based Access Architecture

| Role | Admin Dashboard | Mobile App | API Access Level |
|------|----------------|------------|------------------|
| **Owner** | ✅ Full access | ✅ Full member access | Highest — can manage admins/moderators, delete community, transfer ownership |
| **Admin** | ✅ Full access | ✅ Full member access | High — can manage posts, events, members, reports, approve/reject events |
| **Moderator** | ✅ Full access (v1 merged with Admin) | ✅ Full member access | Same as Admin in v1. In v2: reduced permissions |
| **Member** | ❌ No access (dashboard shows empty state, not an error) | ✅ Full member access | Standard — can post, comment, react, join events/hangouts, create hangouts, propose events |
| **Visitor** (not authenticated) | ❌ No access | ✅ Read public communities only | Read-only public content |

### v1 Role Merge
`admin` and `moderator` are functionally identical in v1. Both can: manage posts (remove/restore), manage events (approve/reject proposed, edit, delete), manage members (kick, ban from community), review and resolve reports, access all admin dashboard pages.

The Owner additionally can: transfer ownership, promote/demote admins/moderators, delete the community, change community settings.

### v1 Route Convention (no `/owner/*` prefix)
Owner-only actions live at the same route paths as admin/mod actions (e.g., `PATCH /communities/:slug/members/:userId`) — the distinction is enforced by a role check in the backend handler, not by a separate URL namespace.

---

## 1. Authentication Endpoints

Full behavioral detail lives in `AUTH_SPECIFICATION.md`. Wire contract reference: `api_contracts/auth/auth.http`.

| Method | Path | Auth? | Request Body | Response `data` |
|--------|------|-------|--------------|----------------|
| POST | `/auth/register` | No | `{ username, email?, phoneNumber?, password, firstName, lastName, birthDate }` (at least one of email/phoneNumber required; age ≥ 13) | `{ user: { id, username, email, phone_number, phone_verified_at, first_name, last_name, name, birth_date, trust_score, created_at, updated_at, deleted_at }, token }` |
| POST | `/auth/login` | No | `{ identifier, password }` (identifier = email or verified phone number) | `{ user: { id, username, email, ... }, token }` |
| POST | `/auth/logout` | Yes | _(empty)_ | `{ success: true }` |
| POST | `/auth/oauth/:provider` | No | Provider-specific (see `AUTH_SPECIFICATION.md`). `provider` = `google` \| `apple` \| `telegram` | `{ user, token }` or 409 `ACCOUNT_EXISTS_NOT_LINKED` |
| POST | `/auth/bot/:provider` | Bot secret | `provider` = `telegram` \| `whatsapp`. **Dormant in v1** — frontend never calls this | `{ acknowledged: true }` |
| POST | `/auth/link-external` | Yes | `{ provider, idToken?, ... }` | `{ linkedProviders: [...] }` |
| POST | `/auth/verify-phone` | Yes | `{ phoneNumber }` | `{ success: true, message: "OTP sent successfully" }` |
| POST | `/auth/verify-phone/confirm` | Yes | `{ phoneNumber, otp }` | `{ success: true }` |

---

## 2. Response Standard

### Success
```json
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
```
The `meta` field is present only on paginated list endpoints. Single-item responses omit it.

### Error
```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [ ... ] }
}
```

**Standard Error Codes:**
| Code | HTTP | Meaning | Frontend Behavior |
|------|------|---------|-------------------|
| `VALIDATION_ERROR` | 400 | Zod validation failed | Show field-level errors from `details` |
| `UNAUTHORIZED` | 401 | Missing/invalid/expired token | Clear token, redirect to login |
| `FORBIDDEN` | 403 | Valid auth but insufficient permissions | Show "Access Denied" or hide the action |
| `NOT_FOUND` | 404 | Resource does not exist (or user is blocked) | Show "Not Found" page |
| `CONFLICT` | 409 | Unique constraint violation (slug, already a member, etc.) | Show specific conflict message |
| `ACCOUNT_EXISTS_NOT_LINKED` | 409 | OAuth identity's email/phone belongs to an unlinked account | Prompt user to link explicitly |
| `RATE_LIMITED` | 429 | Too many requests | Show "Please wait" / retry after |
| `INTERNAL_ERROR` | 500 | Server error | Show generic error message |

---

## 3. Authorization Matrix

### Legend
- **Owner** = `communities.creator_id == current_user_id`
- **Admin/Mod** = `community_members.role IN ('admin', 'moderator')` for that specific community
- **Member** = `community_members.role = 'member'` for that specific community
- **Self** = `resource.user_id == current_user_id` or `resource.author_id == current_user_id`
- **Public** = No auth required (but still respects visibility/blocks/soft-delete)
- **Auth** = Any logged-in user

### Users
| Endpoint | Method | Who |
|----------|--------|-----|
| `/users/me` | GET | Self |
| `/users/me` | PATCH | Self |
| `/users/me` | DELETE | Self (soft delete) |
| `/users/me/communities` | GET | Self — returns communities where caller is owner/admin/moderator, with their role. Backs the dashboard's "My Communities" home and mobile management-switch visibility. |
| `/users/:id` | GET | Auth (returns 404 if blocked or deleted) |
| `/users/:id/follow` | POST / DELETE | Auth (not self) |
| `/users/:id/block` | POST / DELETE | Auth (not self) |
| `/users/:id/trust-score` | GET | Auth |

### Communities
| Endpoint | Method | Who |
|----------|--------|-----|
| `/communities` | GET | Public (filter by `?categoryId`, `?q`, `?page`, `?limit`) |
| `/communities` | POST | Auth (creates owner + admin member row) |
| `/communities/:slug` | GET | Public (if not private) / Members (if private) |
| `/communities/:slug` | PATCH | Owner only (name, description, rules, bannerUrl, profilePictureUrl, isPrivate — **not** slug or categoryId) |
| `/communities/:slug` | DELETE | Owner (soft delete) |
| `/communities/:slug/join` | POST | Auth |
| `/communities/:slug/leave` | POST | Auth (NOT owner) |
| `/communities/:slug/members` | GET | Admin/Mod/Owner (`?page`, `?limit`, `?role`) |
| `/communities/:slug/members/:userId` | PATCH | Owner only (promote/demote; body: `{ role }`; cannot target owner) |
| `/communities/:slug/members/:userId/kick` | DELETE | Admin/Mod/Owner (cannot target owner) |
| `/communities/:slug/reports` | GET | Admin/Mod/Owner |
| `/communities/:slug/moderation-actions` | GET | Admin/Mod/Owner |

### Posts
| Endpoint | Method | Who |
|----------|--------|-----|
| `/communities/:slug/posts` | GET | Public/Member (respects privacy + blocks + soft delete) |
| `/communities/:slug/posts` | POST | Member+ (`{ title?, content?, mediaUrl?, tags? }`; at least one of title/content/mediaUrl) |
| `/posts/:id` | GET | Public/Member (includes author, community, tags, counts, first 10 comments) |
| `/posts/:id` | PATCH | Self (author only) |
| `/posts/:id` | DELETE | Self / Admin/Mod/Owner (soft delete) |
| `/posts/:id/react` | POST | Auth (toggle — creates if not exists, deletes if exists) |
| `/posts/:id/save` | POST | Auth (toggle) |

### Comments
| Endpoint | Method | Who |
|----------|--------|-----|
| `/posts/:id/comments` | GET | Public/Member (top-level + direct replies, 2-level hierarchy) |
| `/posts/:id/comments` | POST | Member+ (`{ content, parentCommentId? }`) |
| `/comments/:id` | GET | Public/Member |
| `/comments/:id` | PATCH | Self (author only) |
| `/comments/:id` | DELETE | Self / Admin/Mod/Owner (soft delete) |
| `/comments/:id/react` | POST | Auth (toggle) |

### Events
| Endpoint | Method | Who |
|----------|--------|-----|
| `/communities/:slug/events` | GET | Public/Member (respects visibility, approval_status, bans) |
| `/communities/:slug/events` | POST | Member+ (regular member → `proposed`; admin/mod/owner → `approved` + `is_verified`) |
| `/communities/:slug/events/:id` | GET | Public/Member (respects visibility + bans; includes participants count, isParticipant, isSaved) |
| `/communities/:slug/events/:id` | PATCH | Self / Admin/Mod/Owner (cannot change approval_status via PATCH) |
| `/communities/:slug/events/:id` | DELETE | Self / Admin/Mod/Owner (soft delete) |
| `/communities/:slug/events/:id/join` | POST | Auth (check bans, max_participants) |
| `/communities/:slug/events/:id/leave` | POST | Self (participant) |
| `/communities/:slug/events/:id/approve` | POST | Admin/Mod/Owner |
| `/communities/:slug/events/:id/reject` | POST | Admin/Mod/Owner (`{ reason? }`) |
| `/communities/:slug/events/:id/ban` | POST | Admin/Mod/Owner (`{ userId, reason? }`) |
| `/communities/:slug/events/:id/save` | POST | Auth (toggle) |

### Hangouts
| Endpoint | Method | Who |
|----------|--------|-----|
| `/hangouts` | GET | Public (respects visibility + blocks + soft delete; `?page`, `?limit`) |
| `/hangouts` | POST | Auth (`{ title, description?, startsAt, endsAt?, visibility, joinType, maxParticipants?, communityId?, ... }`) |
| `/hangouts/:id` | GET | Public/Member (respects visibility + bans; includes participants, join requests for creator) |
| `/hangouts/:id` | PATCH | Self (creator only) |
| `/hangouts/:id` | DELETE | Self / Admin/Mod/Owner if community-tied (soft delete) |
| `/hangouts/:id/join` | POST | Auth (open type only; check bans) |
| `/hangouts/:id/leave` | POST | Self (participant) |
| `/hangouts/:id/request` | POST | Auth (request_based type) |
| `/hangouts/:id/requests/:userId` | PATCH | Creator only (`{ status: "approved" | "rejected" }`) |
| `/hangouts/:id/ban` | POST | Creator / Admin/Mod/Owner if community-tied (`{ userId, reason? }`) |
| `/hangouts/:id/save` | POST | Auth (toggle) |

### Reports
| Endpoint | Method | Who |
|----------|--------|-----|
| `/reports` | POST | Auth (`{ reason, reportedUserId? | reportedPostId? | reportedCommentId? | reportedEventId? | reportedHangoutId? }` — exactly ONE target) |
| `/reports` | GET | Admin/Mod/Owner (filtered by communities they manage; `?status`, `?page`, `?limit`) |
| `/reports/:id` | PATCH | Admin/Mod/Owner (`{ status }`) |
| `/reports/:id/action` | POST | Admin/Mod/Owner (`{ actionType, notes? }`) |

### Admin Dashboard Endpoints
| Endpoint | Method | Who |
|----------|--------|-----|
| `/admin/communities/:slug` | GET | Admin/Mod/Owner (community details + `myRole` + `memberCount`) |
| `/admin/communities/:slug/stats` | GET | Admin/Mod/Owner (`{ totalMembers, totalPosts, totalEvents, pendingReports, pendingEvents, newMembersThisWeek }`) |
| `/admin/communities/:slug/pending-events` | GET | Admin/Mod/Owner (list proposed events) |
| `/admin/communities/:slug/banned-users` | GET | Admin/Mod/Owner |

### Notifications & Uploads
| Endpoint | Method | Who |
|----------|--------|-----|
| `/notifications` | GET | Auth (`?page`, `?limit`, `?unreadOnly`) |
| `/notifications/:id/read` | PATCH | Auth |
| `/upload/presigned` | POST | Auth (`{ filename, contentType }` → `{ uploadUrl, publicUrl, key }`) |

---

## 4. Query Parameters Standard

### Pagination
`?page=1&limit=20` (default limit: 20, max: 100). Response includes `meta: { page, limit, total, totalPages }`.

### Sorting
`?sort=created_at&order=desc` (default: `created_at DESC`)

### Filtering
`?status=pending` (reports, events) · `?visibility=public` (events/hangouts) · `?categoryId=uuid` (communities) · `?role=member` (community members) · `?unreadOnly=true` (notifications) · `?q=keyword` (full-text search)

---

## 5. File Uploads

### POST /upload/presigned
Generates a presigned URL for direct-to-storage upload.
**Body:** `{ "filename": "...", "contentType": "image/jpeg" }`
**Response:** `{ "uploadUrl": "...", "publicUrl": "...", "key": "..." }`

**Rules:** Max 10MB images, 50MB videos. Allowed types: `image/jpeg`, `image/png`, `image/webp`, `video/mp4`. Backend validates the uploaded file exists before saving the URL to the database.

---

## 6. WebSocket / Realtime (Future)

v1 uses polling for notifications. v2 may introduce Socket.io/SSE channels for real-time notifications and messaging.

---

## 7. Rate Limiting

| Endpoint Group | Limit |
|----------------|-------|
| Auth (login, register) | 5 requests / minute |
| General API | 100 requests / minute |
| Uploads | 10 requests / minute |
| Search | 30 requests / minute |

---

## 8. Response Shape Quick Reference (from `api_contracts/`)

### Register Response
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid", "username": "johndoe", "email": "john@example.com",
      "phone_number": "+251911223344", "phone_verified_at": null,
      "first_name": "John", "last_name": "Doe", "name": "John Doe",
      "birth_date": "1998-04-12T00:00:00.000Z", "trust_score": 50,
      "created_at": "...", "updated_at": "...", "deleted_at": null
    },
    "token": "64-char-hex-string"
  }
}
```

### Login Response
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "username": "johndoe", "email": "john@example.com" },
    "token": "64-char-hex-string"
  }
}
```

### Community List Response
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid", "name": "Outdoor Explorers", "slug": "outdoor-explorers",
      "description": "...", "is_private": false, "memberCount": 14,
      "isMember": false, "myRole": null,
      "category": { "id": "uuid", "name": "outdoor_adventure" }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

### Post Create Response
```json
{
  "success": true,
  "data": {
    "id": "uuid", "communityId": "uuid", "title": "...", "content": "...",
    "mediaUrl": "...", "createdAt": "...", "updatedAt": "...",
    "author": { "id": "uuid", "username": "johndoe", "name": "John Doe", "first_name": "John", "last_name": "Doe", "profile_picture_url": null },
    "tags": ["hiking", "trail"], "reactionCount": 0, "hasReacted": false,
    "hasSaved": false, "commentCount": 0
  }
}
```

For all other response shapes, reference the corresponding `.http` file in `api_contracts/`.

---

*All endpoints validate input with Zod in the backend. The frontend should also validate before submitting (for UX — instant feedback) but the backend is the authority. For auth flow details see `AUTH_SPECIFICATION.md`.*
