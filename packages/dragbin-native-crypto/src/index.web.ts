/**
 * Web stub — DragbinNativeCrypto requires iOS/Android native modules.
 * This file exists solely so Metro doesn't crash on web bundling.
 * None of these functions are callable on web.
 */

const err = () => { throw new Error('ghayb requires a native iOS/Android build — web is not supported') }

export const generateKeyPair   = err
export const encryptMessage    = err
export const decryptMessage    = err
export const encryptPrivateKey = err
export const decryptPrivateKey = err
export const encryptBlob       = err
export const decryptBlob       = err
export const hashPassword      = err
export const exportBytes       = err
export const importBytes       = err
export const exportKeyPair     = err
export const importKeyPair     = err
export const generateSalt      = err
export const bytesToHex        = err
