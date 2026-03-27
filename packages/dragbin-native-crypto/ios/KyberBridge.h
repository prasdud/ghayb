#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface KyberBridge : NSObject

/// Generate a Kyber1024 key pair. Returns { publicKey, privateKey } as Base64 strings.
+ (nullable NSDictionary<NSString *, NSString *> *)generateKeyPairWithError:(NSError **)error;

/// Encapsulate: generate shared secret + ciphertext for a public key.
/// Returns { ciphertext, secret } as Base64 strings.
+ (nullable NSDictionary<NSString *, NSString *> *)encapsulate:(NSString *)publicKeyB64
                                                          error:(NSError **)error;

/// Decapsulate: recover shared secret from ciphertext + private key.
/// Returns shared secret as Base64 string.
+ (nullable NSString *)decapsulate:(NSString *)ciphertextB64
                        privateKey:(NSString *)privateKeyB64
                             error:(NSError **)error;

@end

NS_ASSUME_NONNULL_END
