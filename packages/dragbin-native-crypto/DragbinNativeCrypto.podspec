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

  # Swift + ObjC bridge + vendored C source (downloaded by `node scripts/setup.js`)
  s.source_files = [
    'ios/*.{swift,h,m,c}',
    'ios/kyber_ref/*.{c,h}',
    'ios/argon2ref/include/argon2.h',
    'ios/argon2ref/src/*.{c,h}',
    'ios/argon2ref/src/blake2/*.{c,h}',
  ]

  s.private_header_files = [
    'ios/kyber_ref/*.h',
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
      '"$(PODS_TARGET_SRCROOT)/ios/kyber_ref"',
      '"$(PODS_TARGET_SRCROOT)/ios/argon2ref/include"',
      '"$(PODS_TARGET_SRCROOT)/ios/argon2ref/src"',
    ].join(' '),
    # KYBER_K=4 selects kyber1024 in the pq-crystals reference implementation
    'GCC_PREPROCESSOR_DEFINITIONS' => '$(inherited) KYBER_K=4 ARGON2_NO_THREADS=1',
  }

  s.dependency 'ExpoModulesCore'
end
