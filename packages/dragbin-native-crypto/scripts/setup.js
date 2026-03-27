#!/usr/bin/env node
/**
 * Downloads Kyber1024 reference C source (pq-crystals/kyber) and
 * Argon2 reference C source for iOS native compilation.
 *
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

async function downloadFile(url, dest) {
  process.stdout.write(`  ${path.basename(dest)} ... `);
  await download(url, dest);
  console.log('✓');
}

async function main() {
  // ── CRYSTALS-Kyber round 3 reference implementation ──────────────────────
  // Official source: https://github.com/pq-crystals/kyber
  // Compatible with @dragbin/crypto (which uses PQClean's kyber1024 clean,
  // same algorithm and wire format as the reference implementation).
  const KYBER_BASE = 'https://raw.githubusercontent.com/pq-crystals/kyber/master/ref';
  const KYBER_DEST = path.join(IOS_DIR, 'kyber_ref');

  const KYBER_FILES = [
    'api.h', 'params.h',
    'cbd.c', 'cbd.h',
    'fips202.c', 'fips202.h',
    'indcpa.c', 'indcpa.h',
    'kem.c', 'kem.h',
    'ntt.c', 'ntt.h',
    'poly.c', 'poly.h',
    'polyvec.c', 'polyvec.h',
    'reduce.c', 'reduce.h',
    'symmetric-shake.c', 'symmetric.h',
    'verify.c', 'verify.h',
    'randombytes.h',  // header only — randombytes.c is our iOS impl
  ];

  console.log('\nDownloading pq-crystals/kyber ref (kyber1024)...');
  for (const file of KYBER_FILES) {
    await downloadFile(`${KYBER_BASE}/${file}`, path.join(KYBER_DEST, file));
  }

  // ── Argon2 reference implementation ───────────────────────────────────────
  const ARGON2_BASE = 'https://raw.githubusercontent.com/P-H-C/phc-winner-argon2/master';
  const ARGON2_DEST = path.join(IOS_DIR, 'argon2ref');

  const ARGON2_FILES = [
    ['include/argon2.h',              `${ARGON2_BASE}/include/argon2.h`],
    ['src/argon2.c',                  `${ARGON2_BASE}/src/argon2.c`],
    ['src/core.c',                    `${ARGON2_BASE}/src/core.c`],
    ['src/core.h',                    `${ARGON2_BASE}/src/core.h`],
    ['src/encoding.c',                `${ARGON2_BASE}/src/encoding.c`],
    ['src/encoding.h',                `${ARGON2_BASE}/src/encoding.h`],
    ['src/ref.c',                     `${ARGON2_BASE}/src/ref.c`],
    ['src/thread.c',                  `${ARGON2_BASE}/src/thread.c`],
    ['src/thread.h',                  `${ARGON2_BASE}/src/thread.h`],
    ['src/blake2/blake2b.c',          `${ARGON2_BASE}/src/blake2/blake2b.c`],
    ['src/blake2/blake2.h',           `${ARGON2_BASE}/src/blake2/blake2.h`],
    ['src/blake2/blake2-impl.h',      `${ARGON2_BASE}/src/blake2/blake2-impl.h`],
    ['src/blake2/blamka-round-ref.h', `${ARGON2_BASE}/src/blake2/blamka-round-ref.h`],
  ];

  console.log('\nDownloading Argon2 reference implementation...');
  for (const [dest, url] of ARGON2_FILES) {
    await downloadFile(url, path.join(ARGON2_DEST, dest));
  }

  console.log('\n✅ Setup complete. Run `expo prebuild` next.\n');
}

main().catch((err) => {
  console.error('\n❌', err.message);
  process.exit(1);
});
