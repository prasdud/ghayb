/**
 * iOS implementation of PQClean randombytes using SecRandomCopyBytes.
 * Replaces the libsodium randombytes used in the original kyber-crystals build.
 */
#include "randombytes.h"
#include <Security/Security.h>
#include <stddef.h>
#include <stdint.h>

void randombytes(uint8_t *buf, size_t n) {
    SecRandomCopyBytes(kSecRandomDefault, n, buf);
}
