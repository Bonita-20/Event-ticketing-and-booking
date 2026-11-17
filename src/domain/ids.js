import { randomUUID, randomBytes } from 'node:crypto';

// Unambiguous Crockford-inspired alphabet (no 0/O, 1/I/L)
const SAFE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Generates a cryptographically strong unique identifier.
 * @returns {string}
 */
export function newId() {
  return randomUUID();
}

/**
 * Generates a short, readable 8-character booking reference (e.g., "BK-7K9P-M4X2").
 * Uses rejection sampling over crypto.randomBytes to avoid modulo bias.
 * @returns {string}
 */
export function newReference() {
  const length = 8;
  const alphabetLen = SAFE_ALPHABET.length; // 31
  const maxValidByte = 256 - (256 % alphabetLen); // 248 (eliminates modulo bias)

  let raw = '';
  while (raw.length < length) {
    const bytes = randomBytes(16);
    for (const byte of bytes) {
      if (byte < maxValidByte) {
        raw += SAFE_ALPHABET[byte % alphabetLen];
        if (raw.length === length) break;
      }
    }
  }

  return `BK-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}