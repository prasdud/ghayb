#import "KyberBridge.h"

// pq-crystals/kyber ref API — files downloaded by `node scripts/setup.js`
// Compiled with -DKYBER_K=4 (podspec) to select kyber1024
#include "api.h"
#include "kem.h"

static NSError *kyberError(NSInteger code, NSString *message) {
    return [NSError errorWithDomain:@"DragbinNativeCrypto.Kyber"
                               code:code
                           userInfo:@{NSLocalizedDescriptionKey: message}];
}

@implementation KyberBridge

+ (nullable NSDictionary<NSString *, NSString *> *)generateKeyPairWithError:(NSError **)error {
    uint8_t pk[CRYPTO_PUBLICKEYBYTES];
    uint8_t sk[CRYPTO_SECRETKEYBYTES];

    int rc = crypto_kem_keypair(pk, sk);
    if (rc != 0) {
        if (error) *error = kyberError(1, @"Kyber keypair generation failed");
        return nil;
    }

    return @{
        @"publicKey":  [[NSData dataWithBytes:pk length:sizeof(pk)] base64EncodedStringWithOptions:0],
        @"privateKey": [[NSData dataWithBytes:sk length:sizeof(sk)] base64EncodedStringWithOptions:0],
    };
}

+ (nullable NSDictionary<NSString *, NSString *> *)encapsulate:(NSString *)publicKeyB64
                                                          error:(NSError **)error {
    NSData *pkData = [[NSData alloc] initWithBase64EncodedString:publicKeyB64 options:0];
    if (!pkData || pkData.length != CRYPTO_PUBLICKEYBYTES) {
        if (error) *error = kyberError(2, @"Invalid Kyber public key — expected 1568 bytes");
        return nil;
    }

    uint8_t ct[CRYPTO_CIPHERTEXTBYTES];
    uint8_t ss[CRYPTO_BYTES];

    int rc = crypto_kem_enc(ct, ss, (const uint8_t *)pkData.bytes);
    if (rc != 0) {
        if (error) *error = kyberError(3, @"Kyber encapsulation failed");
        return nil;
    }

    return @{
        @"ciphertext": [[NSData dataWithBytes:ct length:sizeof(ct)] base64EncodedStringWithOptions:0],
        @"secret":     [[NSData dataWithBytes:ss length:sizeof(ss)] base64EncodedStringWithOptions:0],
    };
}

+ (nullable NSString *)decapsulate:(NSString *)ciphertextB64
                        privateKey:(NSString *)privateKeyB64
                             error:(NSError **)error {
    NSData *ctData = [[NSData alloc] initWithBase64EncodedString:ciphertextB64 options:0];
    NSData *skData = [[NSData alloc] initWithBase64EncodedString:privateKeyB64 options:0];

    if (!ctData || ctData.length != CRYPTO_CIPHERTEXTBYTES) {
        if (error) *error = kyberError(4, @"Invalid Kyber ciphertext — expected 1568 bytes");
        return nil;
    }
    if (!skData || skData.length != CRYPTO_SECRETKEYBYTES) {
        if (error) *error = kyberError(5, @"Invalid Kyber private key — expected 3168 bytes");
        return nil;
    }

    uint8_t ss[CRYPTO_BYTES];

    int rc = crypto_kem_dec(
        ss,
        (const uint8_t *)ctData.bytes,
        (const uint8_t *)skData.bytes
    );
    if (rc != 0) {
        if (error) *error = kyberError(6, @"Kyber decapsulation failed");
        return nil;
    }

    return [[NSData dataWithBytes:ss length:sizeof(ss)] base64EncodedStringWithOptions:0];
}

@end
