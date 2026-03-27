require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'DragbinNativeCrypto'
  s.version        = package['version']
  s.summary        = package['description']
  s.license        = 'MIT'
  s.homepage       = 'https://github.com/dragbin'
  s.authors        = 'Dragbin'
  s.platforms      = { :ios => '16.0' }
  s.source         = { :git => '' }

  # Swift + ObjC bridge
  s.source_files = [
    'ios/*.{swift,h,m,c}',
    'ios/pqclean/crypto_kem/kyber1024/clean/*.{c,h}',
    'ios/pqclean/common/randombytes.h',
    'ios/argon2ref/include/argon2.h',
    'ios/argon2ref/src/*.{c,h}',
    'ios/argon2ref/src/blake2/*.{c,h}',
  ]

  s.private_header_files = [
    'ios/pqclean/crypto_kem/kyber1024/clean/*.h',
    'ios/argon2ref/src/*.h',
    'ios/argon2ref/src/blake2/*.h',
  ]

  s.public_header_files = [
    'ios/KyberBridge.h',
    'ios/Argon2Bridge.h',
    'ios/argon2ref/include/argon2.h',
  ]

  s.pod_target_xcconfig = {
    'HEADER_SEARCH_PATHS' => [
      '"$(PODS_TARGET_SRCROOT)/ios/pqclean/common"',
      '"$(PODS_TARGET_SRCROOT)/ios/pqclean/crypto_kem/kyber1024/clean"',
      '"$(PODS_TARGET_SRCROOT)/ios/argon2ref/include"',
      '"$(PODS_TARGET_SRCROOT)/ios/argon2ref/src"',
    ].join(' '),
    'GCC_PREPROCESSOR_DEFINITIONS' => 'ARGON2_NO_THREADS=1',
  }

  s.dependency 'ExpoModulesCore'
end
