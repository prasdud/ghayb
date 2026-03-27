/**
 * iOS implementation of randombytes using SecRandomCopyBytes.
 * Satisfies the randombytes() symbol required by pq-crystals/kyber ref.
 */
#include "randombytes.h"
#include <Security/Security.h>
#include <stddef.h>
#include <stdint.h>

void randombytes(uint8_t *buf, size_t n) {
    SecRandomCopyBytes(kSecRandomDefault, n, buf);
}
