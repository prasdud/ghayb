#!/usr/bin/env node
/**
 * Downloads PQClean Kyber1024 and Argon2 reference C source for iOS.
 * Run once before `expo prebuild`: node scripts/setup.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const IOS_DIR = path.join(__dirname, '..', 'ios');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function downloadAll(files, baseUrl, destBase) {
  for (const file of files) {
    const url = `${baseUrl}/${file}`;
    const dest = path.join(destBase, file);
    process.stdout.write(`  ${file} ... `);
    await download(url, dest);
    console.log('✓');
  }
}

async function main() {
  // ── PQClean Kyber1024 clean ────────────────────────────────────────────────
  const PQCLEAN = 'https://raw.githubusercontent.com/PQClean/PQClean/main';
  const KYBER_SRC = `${PQCLEAN}/crypto_kem/kyber1024/clean`;
  const KYBER_DEST = path.join(IOS_DIR, 'pqclean', 'crypto_kem', 'kyber1024', 'clean');
  const COMMON_DEST = path.join(IOS_DIR, 'pqclean', 'common');

  const KYBER_FILES = [
    'api.h', 'params.h',
    'cbd.c', 'cbd.h',
    'fips202.c', 'fips202.h',
    'indcpa.c', 'indcpa.h',
    'kem.c',
    'ntt.c', 'ntt.h',
    'poly.c', 'poly.h',
    'polyvec.c', 'polyvec.h',
    'reduce.c', 'reduce.h',
    'symmetric-shake.c', 'symmetric-shake.h',
    'verify.c', 'verify.h',
  ];

  console.log('\nDownloading PQClean Kyber1024 clean...');
  await downloadAll(KYBER_FILES, KYBER_SRC, KYBER_DEST);

  // randombytes.h from PQClean common (iOS impl provided separately)
  console.log('\nDownloading PQClean common headers...');
  await downloadAll(['randombytes.h'], `${PQCLEAN}/common`, COMMON_DEST);

  // ── Argon2 reference implementation ───────────────────────────────────────
  const ARGON2 = 'https://raw.githubusercontent.com/P-H-C/phc-winner-argon2/master';
  const ARGON2_DEST = path.join(IOS_DIR, 'argon2ref');

  const ARGON2_FILES = [
    ['include/argon2.h', `${ARGON2}/include/argon2.h`],
    ['src/argon2.c', `${ARGON2}/src/argon2.c`],
    ['src/core.c', `${ARGON2}/src/core.c`],
    ['src/core.h', `${ARGON2}/src/core.h`],
    ['src/encoding.c', `${ARGON2}/src/encoding.c`],
    ['src/encoding.h', `${ARGON2}/src/encoding.h`],
    ['src/ref.c', `${ARGON2}/src/ref.c`],
    ['src/thread.c', `${ARGON2}/src/thread.c`],
    ['src/thread.h', `${ARGON2}/src/thread.h`],
    ['src/blake2/blake2b.c', `${ARGON2}/src/blake2/blake2b.c`],
    ['src/blake2/blake2b.h', `${ARGON2}/src/blake2/blake2b.h`],
    ['src/blake2/blake2.h', `${ARGON2}/src/blake2/blake2.h`],
    ['src/blake2/blake2-impl.h', `${ARGON2}/src/blake2/blake2-impl.h`],
    ['src/blake2/blamka-round-ref.h', `${ARGON2}/src/blake2/blamka-round-ref.h`],
  ];

  console.log('\nDownloading Argon2 reference implementation...');
  for (const [dest, url] of ARGON2_FILES) {
    const fullDest = path.join(ARGON2_DEST, dest);
    process.stdout.write(`  ${dest} ... `);
    await download(url, fullDest);
    console.log('✓');
  }

  console.log('\n✅ Setup complete. You can now run expo prebuild.\n');
}

main().catch((err) => {
  console.error('\n❌', err.message);
  process.exit(1);
});
