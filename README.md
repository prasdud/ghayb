# ghayb

Open-source end-to-end encrypted, post-quantum resistant chat. Goodbye WhatsApp.

Built with [dragbin-crypto](https://github.com/mohitsinghdz/dragbin-crypto) — a native C crypto module for React Native (Kyber1024 + Argon2id).

---

## How the encryption works

Every message is encrypted on-device before it ever leaves your phone. The server stores only ciphertext — it cannot read your messages, see who you're talking to, or access your keys.

### Key generation

When you create an account, a **Kyber1024** key pair is generated on your device. Kyber1024 is a post-quantum KEM (Key Encapsulation Mechanism) standardised by NIST — it is resistant to attacks from quantum computers.

Your private key never leaves your device in plaintext. It is encrypted with **AES-256-GCM** using a key derived from your password via **Argon2id** (64 MB memory, 3 iterations) and stored as an opaque vault on the server. Only your password can unlock it.

### Sending a message (double-wrap scheme)

```
plaintext message
        │
        ▼
  random 256-bit session key K
        │
        ├─── AES-256-GCM(message, K) ──────────────────► encryptedData
        │
        ├─── Kyber1024.encapsulate(recipientPublicKey)
        │       └── secret_r, ciphertext_r
        │               └── AES-GCM(K, secret_r) ──────► kyberEncryptedSessionKey
        │
        └─── Kyber1024.encapsulate(senderPublicKey)
                └── secret_s, ciphertext_s
                        └── AES-GCM(K, secret_s) ──────► senderWrappedKey
```

Three blobs are stored on the server per message. To decrypt, the recipient unwraps `kyberEncryptedSessionKey` with their private key to recover K, then decrypts `encryptedData`. The sender uses `senderWrappedKey` with their own private key — this lets you read your own sent messages after re-login without storing K anywhere.

### Contacts

Your contact list is stored as an encrypted blob on the server (`AES-256-GCM`, key derived via `HKDF-SHA256` from your private key). The server holds an opaque blob — it cannot see who you are connected to.

### Account recovery

At signup a 32-byte random **recovery key** is generated. Your private key is encrypted under this recovery key (same AES-GCM scheme) and stored as a separate vault. If you forget your password, the recovery key decrypts your private key on-device and you set a new password — your message history stays intact. The recovery key is shown once at signup; write it down.

---

## Database schema

```
users
├── id                  uuid PK
├── username            text unique
├── auth_hash           text          bcrypt(Argon2id(password, authSalt))
├── auth_salt           text          base64 salt used client-side to derive authKey
├── vault               text          base64 [IV 12B][AES-GCM(privateKey, password)]
├── vault_salt          text          base64 Argon2id salt for vault key
├── public_key          text          base64 Kyber1024 public key
├── recovery_vault      text          base64 [IV 12B][AES-GCM(privateKey, recoveryKey)]
├── recovery_vault_salt text          base64 Argon2id salt for recovery vault key
├── recovery_hash       text          bcrypt(recoveryKey)
├── encrypted_contacts  text nullable base64 AES-GCM blob of contact list
└── created_at          timestamp

conversations
├── id        uuid PK
├── user_a_id uuid FK → users
├── user_b_id uuid FK → users
└── created_at timestamp
(unique constraint on user_a_id + user_b_id, canonical order: lower UUID first)

messages
├── id                          uuid PK
├── conversation_id             uuid FK → conversations
├── sender_id                   uuid FK → users
├── encrypted_data              text   AES-GCM(message, K)
├── kyber_encrypted_session_key text   recipient's wrapped key
├── sender_wrapped_key          text nullable  sender's wrapped key
└── created_at                  timestamp

device_tokens
├── id         uuid PK
├── user_id    uuid FK → users (cascade delete)
├── token      text unique   Expo push token
└── created_at timestamp
```

---

## Running locally

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.1
- [Docker](https://www.docker.com) (for Postgres)
- Xcode (iOS) or Android Studio (Android)

### 1. Environment

```bash
# root .env — sets DB_PASSWORD used by docker-compose
cp .env.example .env

# server .env — DATABASE_URL is pre-filled for the Docker DB on :8552
cp server/.env.example server/.env
# edit server/.env and set a real JWT_SECRET
```

### 2. Start the database

```bash
docker compose up -d db
```

Postgres will be available on `localhost:8552`.

### 3. Run the server

```bash
cd server
bun install
bun run db:migrate   # apply all Drizzle migrations
bun run dev          # starts on :8551 with hot reload
```

### 4. Run the app

```bash
# from repo root
bun install
npx expo prebuild --clean   # generates ios/ and android/ native projects
npx expo run:ios            # or run:android
```

The app reads `EXPO_PUBLIC_API_URL` from `.env` — it defaults to `http://localhost:8551` if not set.

> The app requires a development build (`run:ios` / `run:android`) — the native crypto module does not work in Expo Go. Push notifications also require a real device.

---

## Full Docker (server + db together)

To run both the API and database in containers:

```bash
# root .env must have DB_PASSWORD and JWT_SECRET
cp .env.example .env   # then fill in both values

docker compose up
```

The API container runs migrations automatically on startup and listens on `:8551`.

---

## Linting

```bash
# app
bun run lint

# server
cd server && bun run lint
```

---

## Building for production

```bash
# install EAS CLI
bun install -g eas-cli
eas login

# configure profiles (first time)
eas build:configure

# build
eas build --platform ios      # or android / all
eas build --platform android
```

---

## Architecture

```
ghayb/
├── app/                    Expo Router screens
│   ├── (main)/             Authenticated screens (chat, contacts, settings)
│   ├── context/            SessionContext — holds keys in memory
│   └── lib/                api.ts · contacts.ts · notifications.ts
├── components/             Shared UI components
├── packages/
│   └── dragbin-native-crypto/   Native C crypto module (Kyber1024, Argon2id)
└── server/
    └── src/
        ├── db/             Drizzle schema + migrations
        ├── middleware/      JWT auth
        └── routes/         auth · users · messages · notifications
```

The private key lives in React state (`SessionContext`) only. It is never written to disk. When the app is killed the user must re-enter their password to decrypt the vault.
