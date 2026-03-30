/**
 * @dragbin/native-crypto — web implementation
 *
 * Uses kyber-crystals (WASM) and hash-wasm (Argon2id) directly.
 * API is identical to index.ts so all app code works unchanged on web.
 */

import kyber from 'kyber-crystals';
import { argon2id } from 'hash-wasm';

// ── Helpers ────────────────────────────────────────────────────────────────

function bytesToB64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function b64ToBytes(b64: string): Uint8Array {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
}

export function exportBytes(data: Uint8Array): string { return bytesToB64(data); }
export function importBytes(b64: string): Uint8Array { return b64ToBytes(b64); }
export function exportKeyPair(kp: { publicKey: Uint8Array; privateKey: Uint8Array }) {
    return { publicKey: bytesToB64(kp.publicKey), privateKey: bytesToB64(kp.privateKey) };
}
export function importKeyPair(enc: { publicKey: string; privateKey: string }) {
    return { publicKey: b64ToBytes(enc.publicKey), privateKey: b64ToBytes(enc.privateKey) };
}
export function generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(16));
}
export function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Key generation ─────────────────────────────────────────────────────────

export async function generateKeyPair(): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }> {
    await kyber.ready;
    return kyber.keyPair();
}

// ── Kyber KEM ──────────────────────────────────────────────────────────────

async function kyberEncapsulate(publicKey: Uint8Array): Promise<{ ciphertext: Uint8Array; secret: Uint8Array }> {
    await kyber.ready;
    const result = await kyber.encrypt(publicKey);
    return { ciphertext: result.cyphertext, secret: result.secret };
}

async function kyberDecapsulate(ciphertext: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> {
    await kyber.ready;
    return kyber.decrypt(ciphertext, privateKey);
}

// ── Password hashing (Argon2id) ────────────────────────────────────────────

export async function hashPassword(password: string, salt: Uint8Array): Promise<Uint8Array> {
    const hashHex = await argon2id({
        password,
        salt,
        parallelism: 4,
        iterations: 3,
        memorySize: 64 * 1024,
        hashLength: 32,
        outputType: 'hex',
    });
    return new Uint8Array(hashHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
}

// ── Private key protection ─────────────────────────────────────────────────

async function deriveAESKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const hashBytes = await hashPassword(password, salt);
    const keyMaterial = await crypto.subtle.importKey('raw', hashBytes, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'HKDF', salt: new Uint8Array(0), info: new TextEncoder().encode('dragbin-argon2-aes'), hash: 'SHA-256' },
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
    return { encryptedPrivateKey: new Uint8Array(encrypted), salt, iv };
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

// ── Message encryption (double-wrap) ───────────────────────────────────────

const KYBER_CT_BYTES = 1568;

async function wrapSessionKey(sessionKeyBytes: Uint8Array, kekSecret: Uint8Array): Promise<Uint8Array> {
    const kek = await crypto.subtle.importKey('raw', kekSecret, { name: 'AES-GCM' }, false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, sessionKeyBytes);
    const blob = new Uint8Array(12 + wrapped.byteLength);
    blob.set(iv);
    blob.set(new Uint8Array(wrapped), 12);
    return blob;
}

async function unwrapSessionKey(wrappedBlob: Uint8Array, kekSecret: Uint8Array): Promise<CryptoKey> {
    const kek = await crypto.subtle.importKey('raw', kekSecret, { name: 'AES-GCM' }, false, ['decrypt']);
    const keyBytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: wrappedBlob.subarray(0, 12) }, kek, wrappedBlob.subarray(12));
    return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
}

export async function encryptMessage(
    message: string,
    recipientPublicKey: Uint8Array,
    senderPublicKey: Uint8Array,
): Promise<{ encryptedData: Uint8Array; recipientWrappedKey: Uint8Array; senderWrappedKey: Uint8Array }> {
    const [{ ciphertext: ct_r, secret: s_r }, { ciphertext: ct_s, secret: s_s }] = await Promise.all([
        kyberEncapsulate(recipientPublicKey),
        kyberEncapsulate(senderPublicKey),
    ]);

    const sessionKeyBytes = crypto.getRandomValues(new Uint8Array(32));
    const [wK_r, wK_s] = await Promise.all([wrapSessionKey(sessionKeyBytes, s_r), wrapSessionKey(sessionKeyBytes, s_s)]);

    const recipientWrappedKey = new Uint8Array(ct_r.length + wK_r.length);
    recipientWrappedKey.set(ct_r); recipientWrappedKey.set(wK_r, ct_r.length);

    const senderWrappedKey = new Uint8Array(ct_s.length + wK_s.length);
    senderWrappedKey.set(ct_s); senderWrappedKey.set(wK_s, ct_s.length);

    const sessionKey = await crypto.subtle.importKey('raw', sessionKeyBytes, { name: 'AES-GCM' }, false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sessionKey, new TextEncoder().encode(message));

    const encryptedData = new Uint8Array(12 + encrypted.byteLength);
    encryptedData.set(iv); encryptedData.set(new Uint8Array(encrypted), 12);

    return { encryptedData, recipientWrappedKey, senderWrappedKey };
}

export async function decryptMessage(
    { encryptedData, wrappedKey }: { encryptedData: Uint8Array; wrappedKey: Uint8Array },
    privateKey: Uint8Array,
): Promise<string> {
    const secret = await kyberDecapsulate(wrappedKey.subarray(0, KYBER_CT_BYTES), privateKey);
    const sessionKey = await unwrapSessionKey(wrappedKey.subarray(KYBER_CT_BYTES), secret);
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: encryptedData.subarray(0, 12) },
        sessionKey,
        encryptedData.subarray(12),
    );
    return new TextDecoder().decode(decrypted);
}

// ── Blob encryption (contacts) ─────────────────────────────────────────────

async function contactsKey(privateKey: Uint8Array, usage: 'encrypt' | 'decrypt'): Promise<CryptoKey> {
    const km = await crypto.subtle.importKey('raw', privateKey, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'HKDF', salt: new Uint8Array(0), info: new TextEncoder().encode('dragbin-contacts-key'), hash: 'SHA-256' },
        km, { name: 'AES-GCM', length: 256 }, false, [usage],
    );
}

export async function encryptBlob(data: unknown, privateKey: Uint8Array): Promise<string> {
    const key = await contactsKey(privateKey, 'encrypt');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(data)));
    const blob = new Uint8Array(12 + encrypted.byteLength);
    blob.set(iv); blob.set(new Uint8Array(encrypted), 12);
    return bytesToB64(blob);
}

export async function decryptBlob<T>(b64: string, privateKey: Uint8Array): Promise<T> {
    const key = await contactsKey(privateKey, 'decrypt');
    const bytes = b64ToBytes(b64);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12) }, key, bytes.subarray(12));
    return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}
