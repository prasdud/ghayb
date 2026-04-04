/**
 * @dragbin/native-crypto — web implementation
 *
 * Delegates to @dragbin/crypto (WASM-based Kyber1024 + Argon2id).
 * API is identical to index.ts (native) so all app code works unchanged on web.
 *
 * NOTE: We use import-then-export instead of barrel `export { } from` syntax
 * because Metro's web bundler has CJS/ESM interop issues with barrel re-exports
 * from CJS modules (the @dragbin/crypto dist is CJS).
 */

import {
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
};
