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

// ── Message encryption ─────────────────────────────────────────────────────
// Matches @dragbin/crypto message.ts exactly:
//   Kyber encapsulate → raw 32-byte secret used directly as AES-GCM key
//   Format: [IV 12 bytes][AES-GCM ciphertext]

export async function encryptMessage(
    message: string,
    publicKey: Uint8Array,
): Promise<{ encryptedData: Uint8Array; kyberEncryptedSessionKey: Uint8Array }> {
    const { ciphertext, secret } = await Native.encapsulate(bytesToB64(publicKey));

    const sessionKey = await crypto.subtle.importKey(
        'raw',
        b64ToBytes(secret),
        { name: 'AES-GCM' },
        false,
        ['encrypt'],
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        sessionKey,
        new TextEncoder().encode(message),
    );

    const encryptedData = new Uint8Array(12 + encrypted.byteLength);
    encryptedData.set(iv, 0);
    encryptedData.set(new Uint8Array(encrypted), 12);

    return {
        encryptedData,
        kyberEncryptedSessionKey: b64ToBytes(ciphertext),
    };
}

export async function decryptMessage(
    encryptedMessage: { encryptedData: Uint8Array; kyberEncryptedSessionKey: Uint8Array },
    privateKey: Uint8Array,
): Promise<string> {
    const { encryptedData, kyberEncryptedSessionKey } = encryptedMessage;

    const secretB64: string = await Native.decapsulate(
        bytesToB64(kyberEncryptedSessionKey),
        bytesToB64(privateKey),
    );

    const sessionKey = await crypto.subtle.importKey(
        'raw',
        b64ToBytes(secretB64),
        { name: 'AES-GCM' },
        false,
        ['decrypt'],
    );

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
