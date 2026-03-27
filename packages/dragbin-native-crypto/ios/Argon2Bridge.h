#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface Argon2Bridge : NSObject

/**
 * Hash a password with Argon2id using parameters matching @dragbin/crypto:
 *   parallelism=4, iterations=3, memorySize=65536 KB, hashLength=32
 *
 * @param password  Plaintext password string
 * @param saltB64   16-byte salt encoded as Base64
 * @returns 32-byte hash encoded as Base64
 */
+ (nullable NSString *)hash:(NSString *)password
                    saltB64:(NSString *)saltB64
                      error:(NSError **)error;

@end

NS_ASSUME_NONNULL_END
