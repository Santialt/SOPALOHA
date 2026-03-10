const crypto = require('crypto');

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

function hashPassword(password) {
  const normalized = String(password || '');
  if (!normalized.trim()) {
    throw new Error('Password is required');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .scryptSync(normalized, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P })
    .toString('hex');

  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  const normalizedPassword = String(password || '');
  const normalizedHash = String(storedHash || '');
  const [algorithm, n, r, p, salt, expectedHash] = normalizedHash.split('$');

  if (
    algorithm !== 'scrypt' ||
    !n ||
    !r ||
    !p ||
    !salt ||
    !expectedHash
  ) {
    return false;
  }

  const actualHash = crypto
    .scryptSync(normalizedPassword, salt, expectedHash.length / 2, {
      N: Number(n),
      r: Number(r),
      p: Number(p)
    })
    .toString('hex');

  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  const actualBuffer = Buffer.from(actualHash, 'hex');

  return (
    expectedBuffer.length === actualBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

module.exports = { hashPassword, verifyPassword };
