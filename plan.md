# Ghayb MVP Plan

## What's done
- `packages/dragbin-native-crypto/` — Expo native module wrapping Kyber1024 (pq-crystals C ref) + Argon2id (PHC C ref) for iOS and Android
- C source downloaded (`ios/kyber_ref/`, `ios/argon2ref/`)
- `react-native-quick-crypto` added to app — polyfills `crypto.subtle` (AES-GCM, HKDF)
- `index.ts` calls `QuickCrypto.install()` at entry
- `metro.config.js` watches the new package

## What's left

### 1. Prebuild
```bash
bun install
npx expo prebuild --clean
npx expo run:ios    # or run:android
```

### 2. Session context
Create `app/context/SessionContext.tsx` — holds decrypted `privateKey` in memory for the session lifetime.

```ts
interface Session {
  username: string
  publicKey: Uint8Array
  privateKey: Uint8Array  // never written to disk raw
  destroy(): void         // zeros memory on logout
}
```

Wrap `app/_layout.tsx` with `<SessionProvider>`.

### 3. Local identity storage
Install `expo-secure-store`.

Store on device after signup (persists across app restarts):
- `encryptedPrivateKey` (Base64) → SecureStore
- `salt` (Base64) → SecureStore
- `iv` (Base64) → SecureStore
- `publicKey` (Base64) → AsyncStorage
- `username` → AsyncStorage

### 4. Signup (`app/signup.tsx`)
1. Validate: passwords match, username not empty
2. `generateKeyPair()` → `{ publicKey, privateKey }`
3. `encryptPrivateKey(privateKey, password)` → `{ encryptedPrivateKey, salt, iv }`
4. Save all to SecureStore / AsyncStorage
5. `POST /users` with `{ username, publicKey: exportBytes(publicKey) }`
6. Create session → navigate to `/(main)`

### 5. Signin (`app/signin.tsx`)
1. Load `{ encryptedPrivateKey, salt, iv }` from SecureStore
2. Show spinner — `decryptPrivateKey(...)` takes ~500ms (Argon2id)
3. On success → create session → navigate to `/(main)`
4. On failure → wrong password error

### 6. Send message (`app/(main)/chat/[id].tsx`)
1. Read recipient `publicKey` from local contact cache
2. `encryptMessage(text, recipientPublicKey)` → `{ encryptedData, kyberEncryptedSessionKey }`
3. `POST /messages` with `{ recipientId, encryptedData: exportBytes(...), kyberEncryptedSessionKey: exportBytes(...) }`
4. Show optimistic local message

### 7. Receive messages (`app/(main)/chat/[id].tsx`)
1. `GET /messages?conversationId=...` on mount + poll
2. For each message: `decryptMessage({ encryptedData, kyberEncryptedSessionKey }, session.privateKey)`
3. Render plaintext

### 8. Connect flow (`app/(main)/index.tsx`)
1. Enter UAUID → `GET /users/:uauid` → get their `publicKey`
2. Save contact locally `{ uauid, publicKey }`
3. Add to chat list

---

## Backend (4 endpoints, stores only ciphertext + public keys)

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/users` | `{ username, publicKey }` — register identity |
| `GET` | `/users/:username` | returns `{ username, publicKey }` |
| `POST` | `/messages` | `{ recipientId, encryptedData, kyberEncryptedSessionKey }` |
| `GET` | `/messages?conversationId=` | returns encrypted blobs |

Server never sees plaintext. No keys stored server-side.

---

## All crypto imports from `@dragbin/native-crypto`
```ts
import {
  generateKeyPair,
  encryptPrivateKey,
  decryptPrivateKey,
  encryptMessage,
  decryptMessage,
  exportBytes,
  importBytes,
} from '@dragbin/native-crypto'
```
