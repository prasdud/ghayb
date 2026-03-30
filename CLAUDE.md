# Ghayb — Agent KT

Open-source E2EE post-quantum chat. React Native (Expo) frontend, Hono/Bun backend.

## Crypto stack

All crypto goes through `packages/dragbin-native-crypto` — the only crypto import in the app. It is a drop-in replacement for `@dragbin/crypto` using native C (Kyber1024, Argon2id) instead of WASM. Never add a second crypto library.

Key primitives exposed:
- `generateKeyPair()` — Kyber1024
- `encryptPrivateKey(privateKey, password)` / `decryptPrivateKey(...)` — Argon2id + HKDF + AES-GCM
- `hashPassword(password, salt)` — raw Argon2id bytes, used to derive `authKey` for server auth
- `encryptMessage(text, recipientPK, senderPK)` / `decryptMessage({ encryptedData, wrappedKey }, privateKey)` — double-wrap scheme (see below)
- `encryptBlob(data, privateKey)` / `decryptBlob(b64, privateKey)` — AES-GCM keyed from HKDF(privateKey, info=`dragbin-contacts-key`), used for contacts

## Message encryption (double-wrap)

Each message produces three blobs stored on the server:
- `encryptedData` — AES-GCM(message, K)
- `kyberEncryptedSessionKey` — recipient's wrapped key: `[kyberCT_r 1568B][IV 12B][AES-GCM(K, secret_r) 48B]`
- `senderWrappedKey` — sender's wrapped key: same format under sender's Kyber key

On decrypt: pick `senderWrappedKey` if `msg.senderId === session.userId`, else `kyberEncryptedSessionKey`. Pass the chosen blob as `wrappedKey` to `decryptMessage`. This lets both parties read their own messages after re-login.

The server never sees plaintext. Do not change this scheme without updating both the native module and the messages route.

## Auth flow

**Signup:** `generateKeyPair` → derive `authKey = Argon2id(password, authSalt)` (hex) → `encryptPrivateKey(privateKey, password)` → vault as `[IV 12B][ciphertext]` → `POST /auth/register`. Auto-login follows immediately.

**Login:** `GET /auth/salts?username=` → derive `authKey` → `POST /auth/login` → receive `{ userId, vault, publicKey, token }` → slice `vault[0:12]` as IV → `decryptPrivateKey(vault[12:], password, vaultSalt, iv)` → private key in memory only.

The private key is never written to disk. Session is in-memory (`SessionContext`). On app kill the user must re-enter their password.

## Vault format

`vault` and `recoveryVault` stored in the DB are base64 of `[IV 12 bytes][AES-GCM ciphertext]`. Always prepend IV before base64-encoding, always slice first 12 bytes as IV before decrypting. This pattern is used everywhere (vault, recovery vault, encryptBlob blobs).

## Session

`SessionContext` holds `{ userId, username, publicKey, privateKey, token }` in React state. `clearSession()` zeros `privateKey` buffer before nulling state. Always call `clearSession()` on logout — never just navigate away.

Auth guard lives in `app/(main)/_layout.tsx`. If `session` is null it redirects to `/signin` and renders nothing.

## Contacts

Contacts (`{ id, username, publicKey }[]`) are stored as an encrypted blob on the server (`users.encrypted_contacts`). Encrypted with AES-GCM keyed from `HKDF(privateKey, info="dragbin-contacts-key")`. Fetched and decrypted on login via `GET /users/me/contacts`. Updated via `PUT /users/me/contacts` after every contact add. Server holds an opaque blob — no contact graph is visible to the server.

Helper functions in `app/lib/contacts.ts`.

## Push notifications

Expo push notifications via `expo-notifications`. The notification body is always `"there is a new message in your inbox"` — no message content is ever sent. E2EE is preserved end-to-end.

**Device token lifecycle:**
- On signup: `registerPushToken` is called after login; if permission is granted, `notifications_enabled=true` is persisted in SecureStore.
- On signin: if `notifications_enabled=true` in SecureStore, `registerPushToken` is called (token may have changed).
- Settings toggle: enables → request permission + register token with server; disables → unregister token from server. Reverts if OS denies permission.

**Server side:** `POST /messages` looks up `device_tokens` for the recipient and POSTs to `https://exp.host/--/api/v2/push/send` (fire-and-forget). Tokens are stored in `device_tokens` table (unique per token, cascades on user delete). Registered/unregistered via `POST /DELETE /notifications/device-tokens`.

Helper functions in `app/lib/notifications.ts`.

## Backend routes

All authenticated routes require `Authorization: Bearer <token>`. Auth middleware sets `c.get('userId')`.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/auth/register` | — | Creates user, bcrypts authKey + recoveryKey |
| GET | `/auth/salts` | — | Returns authSalt + vaultSalt for a username |
| POST | `/auth/login` | — | Returns userId, vault, publicKey, token |
| POST | `/auth/recover` | — | Reset password via recovery key |
| GET | `/users/me/contacts` | JWT | Encrypted contacts blob |
| PUT | `/users/me/contacts` | JWT | Overwrite contacts blob |
| GET | `/users/:username` | JWT | Returns id, username, publicKey |
| POST | `/messages` | JWT | Send encrypted message |
| GET | `/messages` | JWT | Fetch messages by conversationId |
| GET | `/conversations` | JWT | Find conversationId by otherUserId |
| POST | `/notifications/device-tokens` | JWT | Register Expo push token |
| DELETE | `/notifications/device-tokens` | JWT | Unregister Expo push token |

## DB migrations

Drizzle migrations live in `server/drizzle/`. Always write a new `.sql` file — never edit existing migrations. Run with `bun run migrate` inside `server/`.

Current columns of note:
- `users.vault` — `[IV][AES-GCM(privateKey)]` under password
- `users.encrypted_contacts` — nullable, opaque blob
- `messages.kyber_encrypted_session_key` — recipient's wrapped key
- `messages.sender_wrapped_key` — nullable, sender's wrapped key (null on pre-double-wrap rows)
- `device_tokens.token` — unique Expo push token per device; `user_id` cascades on user delete

## Known limitations

- **Push notifications are opt-in** — messages only arrive while the app is open (3s polling) unless the user enables notifications in settings
- **Push requires a development build** — `expo-notifications` does not work in Expo Go; must use `npx expo run:ios` or a standalone build
- **Chat history requires one send** if both users have never messaged before and arrive simultaneously — `GET /conversations` returns null until first `POST /messages` creates the row
- **Last-write-wins** on contacts sync — simultaneous contact adds on two devices may lose one entry

## Running

```bash
# backend
cd server && bun install && bun run migrate && bun run dev

# app
bun install
npx expo prebuild --clean
npx expo run:ios   # or run:android
```

Set `EXPO_PUBLIC_API_URL` in `.env` to point at the server. Default is `http://localhost:8551`.
