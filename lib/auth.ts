import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';

const SALT_LENGTH = 16;
const ITERATIONS = 310000;
const KEY_LENGTH = 32;
const DIGEST = 'sha256';

export type StoredUser = {
  user_id: string;
  username: string;
  password_hash: string;
  password_salt: string;
  created_at: string;
};

export function hashPassword(password: string): { password_hash: string; password_salt: string } {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');

  return { password_hash: hash, password_salt: salt };
}

export function verifyPassword(password: string, password_hash: string, password_salt: string): boolean {
  const derivedHash = pbkdf2Sync(password, password_salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  const inputBuffer = Buffer.from(derivedHash);
  const expectedBuffer = Buffer.from(password_hash);

  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(inputBuffer, expectedBuffer);
}

export function createUserId(): string {
  return randomBytes(8).toString('hex');
}

export function sanitizeUser(user: StoredUser | null | undefined) {
  if (!user) {
    return null;
  }

  const { password_hash, password_salt, ...safeUser } = user;
  return safeUser;
}
