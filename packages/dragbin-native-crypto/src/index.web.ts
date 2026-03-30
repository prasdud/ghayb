/**
 * @dragbin/native-crypto — web implementation
 *
 * Drop-in replacement backed by @dragbin/crypto (WASM Kyber1024 + Argon2id)
 * instead of the native C module. API is identical to index.ts.
 */

import {
    generateKeyPair,
    encryptPrivateKey,
    decryptPrivateKey,
    kyberEncapsulate,
    kyberDecapsulate,
    hashPassword,
    exportBytes,
    importBytes,
    exportKeyPair,
    importKeyPair,
    generateSalt,
} from '@dragbin/crypto';

export {
    generateKeyPair,
    encryptPrivateKey,
    decryptPrivateKey,
    hashPassword,
    exportBytes,
    importBytes,
    exportKeyPair,
    importKeyPair,
    generateSalt,
};

// ── Message encryption (double-wrap) ───────────────────────────────────────
// Identical scheme to index.ts — two Kyber encapsulations, one session key K.

const KYBER_CT_BYTES = 1568;

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
    const [{ ciphertext: kyberCT_r, secret: secret_r }, { ciphertext: kyberCT_s, secret: secret_s }] =
        await Promise.all([
            kyberEncapsulate(recipientPublicKey),
            kyberEncapsulate(senderPublicKey),
        ]);

    const sessionKeyBytes = crypto.getRandomValues(new Uint8Array(32));
    const [wrappedK_r, wrappedK_s] = await Promise.all([
        wrapSessionKey(sessionKeyBytes, secret_r),
        wrapSessionKey(sessionKeyBytes, secret_s),
    ]);

    const recipientWrappedKey = new Uint8Array(kyberCT_r.length + wrappedK_r.length);
    recipientWrappedKey.set(kyberCT_r, 0);
    recipientWrappedKey.set(wrappedK_r, kyberCT_r.length);

    const senderWrappedKey = new Uint8Array(kyberCT_s.length + wrappedK_s.length);
    senderWrappedKey.set(kyberCT_s, 0);
    senderWrappedKey.set(wrappedK_s, kyberCT_s.length);

    const sessionKey = await crypto.subtle.importKey('raw', sessionKeyBytes, { name: 'AES-GCM' }, false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sessionKey, new TextEncoder().encode(message));

    const encryptedData = new Uint8Array(12 + encrypted.byteLength);
    encryptedData.set(iv, 0);
    encryptedData.set(new Uint8Array(encrypted), 12);

    return { encryptedData, recipientWrappedKey, senderWrappedKey };
}

export async function decryptMessage(
    encryptedMessage: { encryptedData: Uint8Array; wrappedKey: Uint8Array },
    privateKey: Uint8Array,
): Promise<string> {
    const { encryptedData, wrappedKey } = encryptedMessage;
    const kyberCT = wrappedKey.subarray(0, KYBER_CT_BYTES);
    const wrappedK = wrappedKey.subarray(KYBER_CT_BYTES);
    const secret = await kyberDecapsulate(kyberCT, privateKey);
    const sessionKey = await unwrapSessionKey(wrappedK, secret);
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: encryptedData.subarray(0, 12) },
        sessionKey,
        encryptedData.subarray(12),
    );
    return new TextDecoder().decode(decrypted);
}

// ── Blob encryption (contacts) ─────────────────────────────────────────────

async function privateKeyToCryptoKey(privateKey: Uint8Array, usage: 'encrypt' | 'decrypt'): Promise<CryptoKey> {
    const keyMaterial = await crypto.subtle.importKey('raw', privateKey, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'HKDF', salt: new Uint8Array(0), info: new TextEncoder().encode('dragbin-contacts-key'), hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        [usage],
    );
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
    let binary = '';
    for (let i = 0; i < blob.length; i++) binary += String.fromCharCode(blob[i]);
    return btoa(binary);
}

export async function decryptBlob<T>(b64: string, privateKey: Uint8Array): Promise<T> {
    const key = await privateKeyToCryptoKey(privateKey, 'decrypt');
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: bytes.subarray(0, 12) },
        key,
        bytes.subarray(12),
    );
    return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}

// ── Utilities ──────────────────────────────────────────────────────────────

export function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
