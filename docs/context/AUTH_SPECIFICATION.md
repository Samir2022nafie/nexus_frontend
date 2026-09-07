# Authentication & Authorization Specification (Frontend Integration Guide)
> **Version:** 3.0 (Frontend-Only — describes the existing NestJS backend's auth system as consumed by the admin dashboard and mobile app)
> **Status:** All auth endpoints are built, tested, and passing in the NestJS backend. The frontend consumes them — it does not build them.
> **Paste this file alongside** `00-SYSTEM_CONTEXT.md`, `API_SPECIFICATION.md`, and `prisma/schema.prisma` at the start of any new chat before requesting code. **This file is ground truth for how auth works in the backend the frontend integrates with.**

---

## 1. Backend Auth Stack (Read-Only Reference)

The NestJS backend uses:
- **Session-based bearer tokens** stored in the `sessions` table (not JWTs, not cookies)
- **bcrypt** for password hashing (stored in `user_external_accounts.password` column, provider = `'credential'`)
- **Zod** for all input validation in the service layer
- **CASL** (`@casl/ability`) for ability-based authorization, combined with a `CommunityRoleGuard` for community-scoped role checks
- **AuthGuard** (global) — runs on every request; extracts `Bearer <token>` from the `Authorization` header, looks up the `sessions` table, resolves the full user row, checks `deleted_at`, attaches `req.user` and `req.session`
- **`@Public()` decorator** — endpoints that allow unauthenticated access. The guard still runs; if a token is present, the user is resolved; if absent, the request proceeds without a user

### What the Frontend Needs to Know
The backend does NOT use:
- JWTs (no decoding needed, no expiry embedded in the token itself)
- Cookies (never set, never read)
- Better-Auth (that was the original plan's library — the actual backend does not use it)

The token is an opaque 64-character hex string. The frontend stores it, attaches it as `Authorization: Bearer <token>`, and forgets about auth internals.

---

## 2. How to Authenticate Every Request from the Frontend

### Token Storage
- **Admin Dashboard (Next.js web app):** Store the token in `localStorage` under a key like `bearer_token`.
- **React Native Mobile App:** Store the token in `expo-secure-store` (NOT `AsyncStorage` — SecureStore uses the OS keychain).

### Attaching the Token
Every API call (except `POST /auth/register` and `POST /auth/login`) must include:
```
Authorization: Bearer <token>
```

### Handling 401 Responses
When any API call returns 401 (`UNAUTHORIZED`):
1. Clear the stored token.
2. Redirect to the login screen.
3. Do NOT retry the request.

### Handling 403 Responses
When any API call returns 403 (`FORBIDDEN`):
1. Show an "Access Denied" message or redirect to the appropriate page.
2. Do NOT clear the token — the user is authenticated, just not authorized for this action.

---

## 3. Login Flow: Email OR Verified Phone

The login endpoint accepts a single `identifier` field that can be either an email address or a verified phone number.

### Frontend Login Implementation
```
POST /api/v1/auth/login
Body: { "identifier": "john@example.com", "password": "..." }
  — or —
Body: { "identifier": "+251911223344", "password": "..." }
```

**Response on success (HTTP 201):**
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "username": "johndoe", "email": "john@example.com" },
    "token": "090643aaf4f07369894ad4301cc4ef72e2542e3f97979608282c5f7efdab54a2"
  }
}
```

**Response on failure (HTTP 401):**
```json
{
  "success": false,
  "error": { "code": "UNAUTHORIZED", "message": "Invalid credentials" }
}
```

**The login form should:**
1. Have a single "Email or Phone Number" input field (not two separate fields).
2. Have a password field.
3. Submit `{ identifier, password }` to the backend.
4. On success: store `data.token`, store `data.user`, redirect to dashboard home / mobile home.
5. On failure: show "Invalid credentials" — do NOT distinguish between "user not found" and "wrong password" (the backend doesn't either).

**Phone login will fail (return 401) if the phone number has not been verified** via `POST /auth/verify-phone` + `POST /auth/verify-phone/confirm`. The frontend should NOT try to explain why — the backend returns a generic "Invalid credentials" for both cases.

---

## 4. Registration Flow

```
POST /api/v1/auth/register
Body: {
  "username": "johndoe",
  "email": "john@example.com",       // optional if phoneNumber is provided
  "phoneNumber": "+251911223344",     // optional if email is provided
  "password": "SuperSecretPassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "birthDate": "1998-04-12"           // YYYY-MM-DD, must be ≥ 13 years ago
}
```

**Rules for the registration form:**
1. **At least one of `email` or `phoneNumber` is required** — use a toggle/segmented control or show both fields and validate that at least one is filled.
2. **`username`** is required and globally unique.
3. **`firstName`**, **`lastName`**, **`birthDate`** are required regardless of auth method.
4. **`birthDate`** must make the user at least 13 years old — validate in the frontend AND rely on backend validation.
5. **`phoneNumber`** if provided, is stored unverified. It does NOT unlock phone login until verified via OTP.

**Response on success (HTTP 201):** Same shape as login — includes `user` and `token`. The user is automatically logged in after registration.

---

## 5. Phone Verification (OTP)

Phone verification is a post-registration step. The user must be logged in (authenticated) to verify their phone number.

### Step 1: Request OTP
```
POST /api/v1/auth/verify-phone
Authorization: Bearer <token>
Body: { "phoneNumber": "+251911223344" }
```
**Response:** `{ "success": true, "data": { "success": true, "message": "OTP sent successfully" } }`

In development, the OTP is logged to the backend console — there is no actual SMS provider wired up yet.

### Step 2: Confirm OTP
```
POST /api/v1/auth/verify-phone/confirm
Authorization: Bearer <token>
Body: { "phoneNumber": "+251911223344", "otp": "123456" }
```
**Response on success:** `{ "success": true, "data": { "success": true } }`

After confirmation, `phone_verified_at` is set on the user record. This:
- Unlocks phone-based login (the phone number can now be used as the `identifier` in `/auth/login`)
- Adds the phone verification bonus to the user's trust score

---

## 6. OAuth & Telegram Login

The backend supports OAuth-style login for Google, Apple, and Telegram via a single dynamic route:

```
POST /api/v1/auth/oauth/:provider
Body: provider-specific payload
```

### Google / Apple
Body: `{ "idToken": "...", "email": "...", "birthDate": "1998-04-12" }`

### Telegram (Login Widget)
Body: `{ "id": 123456789, "first_name": "John", "last_name": "Doe", "username": "johndoe", "photo_url": "...", "auth_date": 1630000000, "hash": "..." }`

### Behavior
- If the provider identity matches an existing account → login (return user + token).
- If the provider identity is new → create account (may prompt for missing `birthDate`).
- If the provider identity's email/phone matches an **existing unlinked account** → return 409 `ACCOUNT_EXISTS_NOT_LINKED`. The frontend should prompt the user to log in with their existing account first, then link the provider via `POST /auth/link-external`.
- **Never auto-merge** OAuth accounts by email or phone.

### Linking External Providers (Post-Login)
```
POST /api/v1/auth/link-external
Authorization: Bearer <token>
Body: { "provider": "google", "idToken": "..." }
```
**Response:** `{ "success": true, "data": { "linkedProviders": ["credential", "google"] } }`

---

## 7. Logout

```
POST /api/v1/auth/logout
Authorization: Bearer <token>
```
**Response:** `{ "success": true, "data": { "success": true } }`

This revokes the session in the `sessions` table. The token is no longer valid after this call. The frontend must:
1. Clear the stored token.
2. Clear any cached user data.
3. Redirect to the login screen.

---

## 8. User Profile Endpoints

### Get Current User
```
GET /api/v1/users/me
Authorization: Bearer <token>
```
Returns the **full user row**: `id`, `username`, `email`, `phone_number`, `phone_verified_at`, `first_name`, `last_name`, `name`, `birth_date`, `bio`, `profile_picture_url`, `trust_score`, `created_at`, `updated_at`, `deleted_at`.

### Update Current User
```
PATCH /api/v1/users/me
Authorization: Bearer <token>
Body: { "firstName?", "lastName?", "bio?", "profilePictureUrl?", "phoneNumber?" }
```
**Note:** Changing `phoneNumber` resets `phone_verified_at` to `null` — the user must re-verify.

### Delete Current User (Soft Delete)
```
DELETE /api/v1/users/me
Authorization: Bearer <token>
```
Sets `deleted_at = NOW()`. Revokes all sessions.

### Get Managed Communities
```
GET /api/v1/users/me/communities
Authorization: Bearer <token>
```
Returns communities where the user is owner/admin/moderator, with `role`, `memberCount`, etc. **This is the endpoint that drives:**
- The dashboard's "My Communities" home page
- The mobile app's management-switch visibility check (show "Manage" button only if this returns results)

---

## 9. Security Doctrine (Critical for Frontend Developers)

### The Core Rule
**The frontend cannot enforce security.** The Admin Dashboard and Mobile App are cosmetic and navigational — they make the API usable, they do not make the API secure. Every role/ownership check happens in the NestJS backend.

### What the Frontend Does
1. **Hides UI elements the user probably can't use** (UX convenience, not security). Example: hide "Delete Community" button for non-owners.
2. **Redirects to `/login` on 401** (session expired or invalid).
3. **Shows "Access Denied" on 403** (valid auth but insufficient permissions).
4. **Shows validation errors from the `details` array on 400**.

### What the Frontend NEVER Does
1. **Never stores roles in local state as a security gate.** If a user opens DevTools, sets `isAdmin: true` in local state, and clicks "Delete Community," the backend returns 403 regardless.
2. **Never computes authorization decisions.** The backend is the sole authority. The frontend only uses role information (from `myRole` in API responses or from `GET /users/me/communities`) to decide what UI to render — never to decide what API calls to block.
3. **Never skips an API call because "the user shouldn't be allowed."** Always let the backend decide.

### The Dev Tools Test
If you can break the app's security by modifying `localStorage`, component state, or network requests via DevTools, the frontend has a security bug. But the *platform* should not have one — because the backend independently validates everything.

---

## 10. Auth Flow Summary for Frontend Implementation

### Dashboard (Next.js with shadcn/ui)
1. User visits `/login` → enters identifier (email or phone) + password → `POST /auth/login`
2. On success: store `token` in `localStorage`, store `user` in React Query cache or Zustand, redirect to `/`
3. API client reads `bearer_token` from `localStorage`, attaches to every request
4. On 401 from any endpoint: clear token, redirect to `/login`
5. On app load: check if `bearer_token` exists in `localStorage` → if yes, call `GET /users/me` to validate it → if 401, clear and redirect

### Mobile App (React Native with Expo)
1. App boots → check `expo-secure-store` for token → if exists, call `GET /users/me` to validate → hydrate auth store
2. If no token or validation fails → show Auth Navigator (Login / Register screens)
3. User logs in → store token in `expo-secure-store`, store user in Zustand → show Main Navigator
4. Axios interceptor attaches `Authorization: Bearer <token>` to every request
5. Axios response interceptor on 401: clear SecureStore token, navigate to Login

---

## 11. Environment Variables for Frontend

### Admin Dashboard (`.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Mobile App (`.env` or app config)
```
EXPO_PUBLIC_API_URL=http://192.168.1.x:3000
```
Use the LAN IP, not `localhost` — the mobile device/simulator can't reach `localhost` on your development machine.

---

*Authentication is fully built and tested in the NestJS backend. The frontend's only job is to call the auth endpoints, store the token securely, attach it to every request, and handle 401/403 gracefully. For endpoint wire details, see `api_contracts/auth/auth.http`.*
