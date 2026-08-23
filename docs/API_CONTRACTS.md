# API Contracts — Vercel Serverless Functions

Interface control documents for the two custom HTTP integrations that bridge
the client to Supabase with elevated (service-role) privileges. These are the
ONLY server-side endpoints in the system; every other operation goes directly
from the browser to Supabase under Row Level Security.

Shared conventions for both endpoints:

- **Transport:** HTTPS POST, JSON body, deployed at `/api/<function>` on Vercel.
- **Authentication:** `Authorization: Bearer <Supabase access token>` header.
  The token is verified against Supabase Auth; the caller's `profiles.role`
  must be `owner` or `staff` (members are rejected).
- **Secrets:** `SUPABASE_SERVICE_ROLE_KEY` is read from server-side env vars
  and never exposed to the browser. The anon key is used only to verify the
  caller's token.
- **Error taxonomy:** all errors return a JSON body of
  `{ "error": "<human-readable sentence>" }`. Validation failures use 400;
  identity/permission failures 401/403; missing resources 404; conflicts 409;
  infrastructure failures 500 (details logged server-side via `console.error`,
  never returned to the client).

---

## POST /api/create-login

Creates a Supabase auth account for a walk-in member who has no login yet,
then links it to the member record.

### Request

| Field | Type | Required | Notes |
|---|---|---|---|
| `memberId` | string | yes | UUID of the `members` row |
| `email` | string | yes | Trimmed + lowercased server-side; syntax-validated |
| `password` | string | yes | Minimum 6 characters (chosen by staff on the member's behalf) |

### Responses

| Status | Condition | Body |
|---|---|---|
| 200 | Account created and linked | `{ ok: true, email }` |
| 400 | Missing member ID / invalid email / password < 6 chars | `{ error }` |
| 401 | Missing/invalid bearer token | `{ error: 'Sign in to continue.' }` |
| 403 | Caller role is not owner/staff | `{ error: 'Only owner or staff can create member logins.' }` |
| 404 | Member ID does not exist | `{ error: 'Member not found.' }` |
| 409 | Member already linked, OR auth email already registered | `{ error }` |
| 405 | Non-POST method | `{ error: 'Method not allowed.' }` |
| 500 | Env missing, or create/link step failed (created user is rolled back on link failure) | `{ error }` |

### Side effects

1. Creates an `auth.users` row (email pre-confirmed).
2. Sets `members.user_id` to the new user id.
3. Rollback guarantee: if the link step fails after user creation, the created
   auth user is deleted before returning 500.

---

## POST /api/link-account

Links a member record to an EXISTING auth account (resolves self-signup
orphans). No new account is created.

### Request

| Field | Type | Required | Notes |
|---|---|---|---|
| `memberId` | string | yes | UUID of the unlinked `members` row |
| `email` | string | yes | The email the person signed up with |

### Responses

| Status | Condition | Body |
|---|---|---|
| 200 | Existing account found and linked | `{ ok: true, email }` |
| 400 | Missing member ID / invalid email | `{ error }` |
| 401 | Missing/invalid bearer token | `{ error: 'Sign in to continue.' }` |
| 403 | Caller role is not owner/staff | `{ error: 'Only owner or staff can link member logins.' }` |
| 404 | Member not found, OR no auth account with that email exists (body suggests using Create login) | `{ error }` |
| 409 | Member already linked, OR the auth account is already linked to a different member | `{ error }` |
| 405 | Non-POST method | `{ error: 'Method not allowed.' }` |
| 500 | Env missing, or lookup/link failed | `{ error }` |

### Side effects

Sets `members.user_id` to the matched existing user id. No auth rows are
created or deleted.

---

## Sequence (create-login happy path)

See `docs/ARCHITECTURE.md` § sequence diagrams — "Create member login".
