/**
 * @dragbin/native-crypto
 *
 * Drop-in replacement for @dragbin/crypto for React Native.
 * Uses native Kyber1024 + Argon2id, and crypto.subtle (polyfilled by
 * react-native-quick-crypto) for AES-GCM and HKDF.
 *
 * API is intentionally identical to @dragbin/crypto so the app can swap
 * imports without changing call sites.
 */

import { requireNativeModule } from 'expo-modules-core';

const Native = requireNativeModule('DragbinNativeCrypto');

// ── Helpers ────────────────────────────────────────────────────────────────

function b64ToBytes(b64: string): Uint8Array {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
}

function bytesToB64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

// ── Key generation ─────────────────────────────────────────────────────────

export async function generateKeyPair(): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }> {
    const result: { publicKey: string; privateKey: string } = await Native.generateKeyPair();
    return {
        publicKey:  b64ToBytes(result.publicKey),
        privateKey: b64ToBytes(result.privateKey),
    };
}

// ── Message encryption (double-wrap) ───────────────────────────────────────
//
// Blob format for recipientWrappedKey / senderWrappedKey:
//   [Kyber ciphertext: 1568 bytes][IV: 12 bytes][AES-GCM(K): 48 bytes]
//
// encryptedData format: [IV: 12 bytes][AES-GCM(message)]
//
// Flow:
//   1. encapsulate(recipientPK) → { kyberCT_r, secret_r }
//   2. encapsulate(senderPK)    → { kyberCT_s, secret_s }
//   3. random 32-byte session key K
//   4. AES-GCM-encrypt(K, key=secret_r) → wrappedK_r
//   5. AES-GCM-encrypt(K, key=secret_s) → wrappedK_s
//   6. AES-GCM-encrypt(message, key=K)  → encryptedData

async function wrapSessionKey(sessionKeyBytes: Uint8Array, kekSecret: Uint8Array): Promise<Uint8Array> {
    const kek = await crypto.subtle.importKey('raw', kekSecret, { name: 'AES-GCM' }, false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, sessionKeyBytes);
    const blob = new Uint8Array(12 + wrapped.byteLength);
    blob.set(iv, 0);
    blob.set(new Uint8Array(wrapped), 12);
    return blob;
}

async function unwrapSessionKey(wrappedBlob: Uint8Array, kekSecret: Uint8Array): Promise<CryptoKey> {
    const kek = await crypto.subtle.importKey('raw', kekSecret, { name: 'AES-GCM' }, false, ['decrypt']);
    const iv = wrappedBlob.subarray(0, 12);
    const wrapped = wrappedBlob.subarray(12);
    const keyBytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, kek, wrapped);
    return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
}

export async function encryptMessage(
    message: string,
    recipientPublicKey: Uint8Array,
    senderPublicKey: Uint8Array,
): Promise<{ encryptedData: Uint8Array; recipientWrappedKey: Uint8Array; senderWrappedKey: Uint8Array }> {
    // Kyber encapsulate for both parties
    const [{ ciphertext: kyberCT_r, secret: secret_r }, { ciphertext: kyberCT_s, secret: secret_s }] =
        await Promise.all([
            Native.encapsulate(bytesToB64(recipientPublicKey)) as Promise<{ ciphertext: string; secret: string }>,
            Native.encapsulate(bytesToB64(senderPublicKey)) as Promise<{ ciphertext: string; secret: string }>,
        ]);

    // Random session key K
    const sessionKeyBytes = crypto.getRandomValues(new Uint8Array(32));

    // Wrap K for each party using their Kyber-derived secret as KEK
    const [wrappedK_r, wrappedK_s] = await Promise.all([
        wrapSessionKey(sessionKeyBytes, b64ToBytes(secret_r)),
        wrapSessionKey(sessionKeyBytes, b64ToBytes(secret_s)),
    ]);

    // Build wrapped key blobs: [kyberCT (1568 bytes)][IV+wrappedK (60 bytes)]
    const recipientWrappedKey = new Uint8Array(b64ToBytes(kyberCT_r).length + wrappedK_r.length);
    recipientWrappedKey.set(b64ToBytes(kyberCT_r), 0);
    recipientWrappedKey.set(wrappedK_r, b64ToBytes(kyberCT_r).length);

    const senderWrappedKey = new Uint8Array(b64ToBytes(kyberCT_s).length + wrappedK_s.length);
    senderWrappedKey.set(b64ToBytes(kyberCT_s), 0);
    senderWrappedKey.set(wrappedK_s, b64ToBytes(kyberCT_s).length);

    // Encrypt message with K
    const sessionKey = await crypto.subtle.importKey('raw', sessionKeyBytes, { name: 'AES-GCM' }, false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sessionKey, new TextEncoder().encode(message));

    const encryptedData = new Uint8Array(12 + encrypted.byteLength);
    encryptedData.set(iv, 0);
    encryptedData.set(new Uint8Array(encrypted), 12);

    return { encryptedData, recipientWrappedKey, senderWrappedKey };
}

// Kyber ciphertext for Kyber1024 is 1568 bytes
const KYBER_CT_BYTES = 1568;

export async function decryptMessage(
    encryptedMessage: { encryptedData: Uint8Array; wrappedKey: Uint8Array },
    privateKey: Uint8Array,
): Promise<string> {
    const { encryptedData, wrappedKey } = encryptedMessage;

    // Split blob into Kyber ciphertext and wrapped K
    const kyberCT = wrappedKey.subarray(0, KYBER_CT_BYTES);
    const wrappedK = wrappedKey.subarray(KYBER_CT_BYTES);

    // Kyber decapsulate → secret (KEK)
    const secretB64: string = await Native.decapsulate(bytesToB64(kyberCT), bytesToB64(privateKey));

    // Unwrap session key K
    const sessionKey = await unwrapSessionKey(wrappedK, b64ToBytes(secretB64));

    // Decrypt message
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: encryptedData.subarray(0, 12) },
        sessionKey,
        encryptedData.subarray(12),
    );

    return new TextDecoder().decode(decrypted);
}

// ── Private key protection ─────────────────────────────────────────────────
// Matches @dragbin/crypto keyDerivation.ts + encryption.ts exactly:
//   Argon2id(password, salt) → 32-byte hash
//   → HKDF-SHA256(info='dragbin-argon2-aes') → AES-GCM-256 key
//   → AES-GCM encrypt/decrypt

async function deriveAESKey(
    password: string,
    salt: Uint8Array,
): Promise<CryptoKey> {
    const hashB64: string = await Native.argon2id(password, bytesToB64(salt));
    const hashBytes = b64ToBytes(hashB64);

    const keyMaterial = await crypto.subtle.importKey('raw', hashBytes, 'HKDF', false, ['deriveKey']);

    return crypto.subtle.deriveKey(
        {
            name: 'HKDF',
            salt: new Uint8Array(0),
            info: new TextEncoder().encode('dragbin-argon2-aes'),
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt'],
    );
}

export async function encryptPrivateKey(
    privateKey: Uint8Array,
    password: string,
): Promise<{ encryptedPrivateKey: Uint8Array; salt: Uint8Array; iv: Uint8Array }> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv   = crypto.getRandomValues(new Uint8Array(12));
    const key  = await deriveAESKey(password, salt);

    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, privateKey);

    return {
        encryptedPrivateKey: new Uint8Array(encrypted),
        salt,
        iv,
    };
}

export async function decryptPrivateKey(
    encryptedPrivateKey: Uint8Array,
    password: string,
    salt: Uint8Array,
    iv: Uint8Array,
): Promise<Uint8Array> {
    const key = await deriveAESKey(password, salt);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encryptedPrivateKey);
    return new Uint8Array(decrypted);
}

// ── User-data encryption (contacts, etc.) ─────────────────────────────────
// Key = SHA-256(privateKey) — if you can log in, you can decrypt your data.
// Blob format: [IV 12 bytes][AES-GCM ciphertext]

async function privateKeyToCryptoKey(privateKey: Uint8Array, usage: 'encrypt' | 'decrypt'): Promise<CryptoKey> {
    const keyBytes = await crypto.subtle.digest('SHA-256', privateKey);
    return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, [usage]);
}

export async function encryptBlob(data: unknown, privateKey: Uint8Array): Promise<string> {
    const key = await privateKeyToCryptoKey(privateKey, 'encrypt');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(JSON.stringify(data)),
    );
    const blob = new Uint8Array(12 + encrypted.byteLength);
    blob.set(iv, 0);
    blob.set(new Uint8Array(encrypted), 12);
    return bytesToB64(blob);
}

export async function decryptBlob<T>(b64: string, privateKey: Uint8Array): Promise<T> {
    const key = await privateKeyToCryptoKey(privateKey, 'decrypt');
    const bytes = b64ToBytes(b64);
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: bytes.subarray(0, 12) },
        key,
        bytes.subarray(12),
    );
    return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}

// ── Serialization (passthrough — same as @dragbin/crypto) ──────────────────

export function exportBytes(data: Uint8Array): string {
    return bytesToB64(data);
}

export function importBytes(b64: string): Uint8Array {
    return b64ToBytes(b64);
}

export function exportKeyPair(kp: { publicKey: Uint8Array; privateKey: Uint8Array }) {
    return { publicKey: bytesToB64(kp.publicKey), privateKey: bytesToB64(kp.privateKey) };
}

export function importKeyPair(encoded: { publicKey: string; privateKey: string }) {
    return { publicKey: b64ToBytes(encoded.publicKey), privateKey: b64ToBytes(encoded.privateKey) };
}

export function generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(16));
}

// Raw Argon2id hash — used to derive the server-side authKey
// Returns same bytes that deriveAESKey feeds into HKDF, but without the HKDF step
export async function hashPassword(password: string, salt: Uint8Array): Promise<Uint8Array> {
    const hashB64: string = await Native.argon2id(password, bytesToB64(salt));
    return b64ToBytes(hashB64);
}

export function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
