# Auth & Key Design — Option 2: Encrypted Vault

---

## Theory

### The problem
Kyber keys are randomly generated. Unlike a password, you cannot re-derive them if
lost. They must be stored somewhere. The question is: where, and in what form?

### The answer: an encrypted vault
The private key never leaves the device in plaintext. Instead it is wrapped in an
encrypted blob (the vault) using a key that is derived from the user's password.
The server stores the vault but cannot open it — only the user's password can.

### Key derivation tree

Everything flows from one master password. Two independent keys are derived from it
using Argon2id with separate salts, so neither can be used to recover the other.

```
password
    │
    ├── Argon2id(password, authSalt)  ──▶  authKey
    │       used to prove identity to the server
    │       server stores bcrypt(authKey), never the key itself
    │
    └── Argon2id(password, vaultSalt) ──▶  vaultKey
            used to encrypt/decrypt the private key
            never sent to server
            server stores the encrypted vault, not vaultKey
```

### Signup (first device)

```
1.  Generate a random Kyber keypair
      { publicKey, privateKey }

2.  Generate two random 16-byte salts
      authSalt, vaultSalt

3.  Derive authKey and vaultKey locally using Argon2id

4.  Encrypt the private key with vaultKey (AES-GCM)
      vault = AES-GCM-256(vaultKey, privateKey)

5.  Send to server:
      { username, authKey, publicKey, vault, authSalt, vaultSalt }

6.  Server stores:
      username     — public identifier
      auth_hash    — bcrypt(authKey)   ← server cannot reverse this
      public_key   — plaintext         ← others encrypt messages to this
      vault        — encrypted blob    ← server cannot read this
      auth_salt    — needed to re-derive authKey on login
      vault_salt   — needed to re-derive vaultKey on login
```

The server has no password, no private key, no vault key. It holds encrypted data
it cannot read.

### Login (same or new device)

```
1.  Client sends username to server
      GET /auth/salts?username=...
      ← { authSalt, vaultSalt }

2.  Client derives authKey locally
      authKey = Argon2id(password, authSalt)

3.  Client sends authKey to server
      POST /auth/login { username, authKey }
      Server verifies: bcrypt.compare(authKey, stored auth_hash)
      ← { vault, publicKey, sessionToken }

4.  Client derives vaultKey locally
      vaultKey = Argon2id(password, vaultSalt)

5.  Client decrypts vault
      privateKey = AES-GCM-decrypt(vaultKey, vault)

6.  privateKey lives in memory for the session lifetime
      Never written to disk. Cleared on logout.
```

Works identically on a new device. No device registration, no QR codes, no seed
phrases. Just username + password.

### What the server sees at every stage

| Data          | Stored as              | Can server read it? |
|---------------|------------------------|---------------------|
| Password      | Never sent             | No                  |
| authKey       | bcrypt hash            | No                  |
| vaultKey      | Never sent             | No                  |
| Private key   | AES-GCM ciphertext     | No                  |
| Public key    | Plaintext              | Yes (intentional)   |
| Messages      | AES-GCM ciphertext     | No                  |

### What happens if the server is breached

An attacker gets: `auth_hash`, `vault`, `auth_salt`, `vault_salt`, `public_key`.

- `auth_hash` → bcrypt, cannot reverse to authKey or password
- `vault` → AES-GCM ciphertext, needs vaultKey to open
- `vaultKey` → derived from password + vaultSalt, never stored anywhere
- Attacker must brute-force the password against Argon2id (64MB RAM, 3 iterations,
  parallelism 4) — computationally infeasible with a strong password

### Session token

After login the server issues a JWT containing only `{ userId, exp }`.
No crypto material in the token. The token proves the client authenticated;
the private key in memory does the actual crypto work.

---

## Implementation plan

### 1. Add `deriveVaultKey` to `@dragbin/native-crypto`

```ts
// src/index.ts — one new export
export async function deriveVaultKey(
    password: string,
    salt: Uint8Array,
): Promise<Uint8Array>
// Calls Native.argon2id(password, salt) — already exists in native module
// Just a named wrapper so call sites are explicit about intent
```

### 2. Database schema (`server/src/db/schema.ts`)

```ts
users
  id          uuid  primary key
  username    text  unique not null
  auth_hash   text  not null          -- bcrypt(authKey)
  auth_salt   text  not null          -- base64, 16 bytes
  vault       text  not null          -- base64 AES-GCM ciphertext
  vault_salt  text  not null          -- base64, 16 bytes
  public_key  text  not null          -- base64 Kyber public key
  created_at  timestamp
```

### 3. Auth routes (`server/src/routes/auth.ts`)

```
POST /auth/register   { username, authKey, authSalt, vault, vaultSalt, publicKey }
GET  /auth/salts      ?username=...  →  { authSalt, vaultSalt }
POST /auth/login      { username, authKey }  →  { vault, publicKey, token }
```

### 4. JWT middleware (`server/src/middleware/auth.ts`)

Verify JWT on protected routes. Sign with a secret from env. Payload: `{ userId }`.

### 5. Wire up signup + signin in the app

- `app/signup.tsx` — call crypto, POST /auth/register, store token
- `app/signin.tsx` — GET /auth/salts, derive keys, POST /auth/login, decrypt vault

### 6. Session context (`app/context/SessionContext.tsx`)

Hold `{ username, publicKey, privateKey }` in memory after login.
`destroy()` zeroes the privateKey bytes and clears the context on logout.

---

## Order to build

1. `deriveVaultKey` in native-crypto package
2. DB schema + migrations
3. `/auth/register` and `/auth/login` routes + JWT
4. App signup wired to crypto + register
5. App signin wired to salts + login + vault decrypt
6. Session context
