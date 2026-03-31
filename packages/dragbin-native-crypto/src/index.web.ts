/**
 * @dragbin/native-crypto — web implementation
 *
 * Delegates to @dragbin/crypto (WASM-based Kyber1024 + Argon2id).
 * API is identical to index.ts (native) so all app code works unchanged on web.
 */

// Re-export everything the app needs directly from @dragbin/crypto
export {
    generateKeyPair,
    encryptMessage,
    decryptMessage,
    encryptPrivateKey,
    decryptPrivateKey,
    hashPassword,
    encryptBlob,
    decryptBlob,
    exportBytes,
    importBytes,
    exportKeyPair,
    importKeyPair,
    generateSalt,
    bytesToHex,
} from '@dragbin/crypto';
