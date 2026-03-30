# Ghayb — Next Steps

MVP is complete and shipped. What follows is a prioritised list of features worth building next.

---

## High priority

### 1. Message delivery receipts
Show sent / delivered / read indicators per message. Requires a `status` column on `messages` and a `PATCH /messages/:id/read` route. The recipient marks messages read on open; the sender sees the tick update via polling or websocket.

### 2. Real-time delivery (WebSocket / SSE)
Replace the 3-second poll in `chat/[id].tsx` with a persistent connection. Hono supports SSE natively. Reduces latency and battery drain. Pair with delivery receipts above.

### 3. Message deletion
`DELETE /messages/:id` — only the sender can delete. Server drops the row. Clients remove it on next poll. Add a long-press context menu in the chat UI.

### 4. Media messages (images / files)
Client encrypts the blob with `encryptBlob`, uploads to object storage (e.g. S3, R2), sends the URL + AES key wrapped under recipient's Kyber key. Server stores only the wrapped key and opaque URL — never the plaintext file.

### 5. Multiple device support / session management
Currently a second device cannot log in without losing push token continuity. Add a `GET /sessions` / `DELETE /sessions/:id` flow so users can view and revoke active devices from settings.

---

## Medium priority

### 6. Username search / discovery
`GET /users/search?q=` with a debounced input in the connect sheet. Currently users must know the exact username. Rate-limit this endpoint aggressively to prevent enumeration.

### 7. Unread badge / notification count
Track unread count per conversation in the contacts list. Increment locally on new push notification tap; reset to zero when the conversation is opened.

### 8. Delete account
The "Destroy Identity" button in settings currently does nothing. Wire it to `DELETE /users/me` — server drops user row (cascades to messages, conversations, device_tokens), client calls `clearSession()` and navigates to `/signup`.

### 9. App lock / biometric auth
The App Lock toggle in settings is wired to local state only. Hook it to `expo-local-authentication` — prompt Face ID / fingerprint before showing the main screen on foreground. Store the `privateKey` in SecureStore under biometric protection as an optional hardening measure.

### 10. QR code contact add
Instead of typing a username, generate a QR that encodes `{ username, publicKey }`. Scan with the camera to add a contact and verify the public key out-of-band simultaneously.

---

## Lower priority / polish

### 11. Key fingerprint verification
Show a short fingerprint (e.g. first 20 hex chars of `SHA-256(publicKey)`) in the contact detail view. Let users confirm it over a side channel to prevent a compromised server from substituting keys.

### 12. Disappearing messages
Per-conversation TTL. Server culls rows older than the agreed TTL via a cron job. Client negotiates TTL in the first message metadata (encrypted).

### 13. Group chats
Non-trivial — requires a shared group key wrapped per-member under each member's Kyber key. Each member re-wraps for new members on join. Schema needs a `groups` table and a many-to-many `group_members` table with per-member wrapped keys.

### 14. iOS / Android share extension
Accept shared content (text, image) from other apps and open the contact picker to forward it into a conversation.

---

## Infrastructure

### 15. CI pipeline
Add GitHub Actions: `bun test` on the server, TypeScript type-check on the app, lint. Block merges on failure.

### 16. Expo EAS build + OTA updates
Configure `eas.json` for development, preview, and production profiles. Enable OTA JS updates for JS-only changes (crypto native module changes still require a full build).
