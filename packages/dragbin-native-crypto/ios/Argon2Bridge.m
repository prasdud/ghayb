#import "Argon2Bridge.h"

// Argon2 reference implementation — files downloaded by `node scripts/setup.js`
#include "argon2.h"

// Parameters matching @dragbin/crypto exactly
static const uint32_t ARGON2_T_COST    = 3;
static const uint32_t ARGON2_M_COST    = 64 * 1024; // 64 MB in KB
static const uint32_t ARGON2_PARALLELISM = 4;
static const uint32_t ARGON2_HASH_LEN  = 32;

@implementation Argon2Bridge

+ (nullable NSString *)hash:(NSString *)password
                    saltB64:(NSString *)saltB64
                      error:(NSError **)error {
    NSData *saltData = [[NSData alloc] initWithBase64EncodedString:saltB64 options:0];
    if (!saltData || saltData.length != 16) {
        if (error) {
            *error = [NSError errorWithDomain:@"DragbinNativeCrypto.Argon2"
                                         code:10
                                     userInfo:@{NSLocalizedDescriptionKey: @"Salt must be exactly 16 bytes"}];
        }
        return nil;
    }

    NSData *passwordData = [password dataUsingEncoding:NSUTF8StringEncoding];
    uint8_t hash[ARGON2_HASH_LEN];

    int rc = argon2id_hash_raw(
        ARGON2_T_COST,
        ARGON2_M_COST,
        ARGON2_PARALLELISM,
        passwordData.bytes, passwordData.length,
        saltData.bytes,     saltData.length,
        hash,               ARGON2_HASH_LEN
    );

    if (rc != ARGON2_OK) {
        if (error) {
            NSString *msg = [NSString stringWithUTF8String:argon2_error_message(rc)];
            *error = [NSError errorWithDomain:@"DragbinNativeCrypto.Argon2"
                                         code:11
                                     userInfo:@{NSLocalizedDescriptionKey: msg}];
        }
        return nil;
    }

    return [[NSData dataWithBytes:hash length:ARGON2_HASH_LEN] base64EncodedStringWithOptions:0];
}

@end
