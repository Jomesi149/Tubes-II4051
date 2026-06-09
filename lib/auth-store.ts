import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { getFirebaseDb, isFirebaseConfigured } from './firebase';
import { createUserId, type StoredUser } from './auth';

const USERS_COLLECTION = 'users';
const USERS_FILE_PATH = path.join(os.tmpdir(), 'ventore-users.json');

async function ensureUsersFile(): Promise<void> {
  await fs.mkdir(path.dirname(USERS_FILE_PATH), { recursive: true });

  try {
    await fs.access(USERS_FILE_PATH);
  } catch {
    await fs.writeFile(USERS_FILE_PATH, '[]', 'utf8');
  }
}

async function readUsersFile(): Promise<StoredUser[]> {
  await ensureUsersFile();
  const raw = await fs.readFile(USERS_FILE_PATH, 'utf8');
  return JSON.parse(raw) as StoredUser[];
}

async function writeUsersFile(users: StoredUser[]): Promise<void> {
  await ensureUsersFile();
  await fs.writeFile(USERS_FILE_PATH, JSON.stringify(users, null, 2), 'utf8');
}

export async function findUserByUsername(username: string): Promise<StoredUser | null> {
  const normalized = username.trim().toLowerCase();

  if (isFirebaseConfigured()) {
    try {
      const db = getFirebaseDb();
      if (db) {
        const q = query(collection(db, USERS_COLLECTION), where('username', '==', normalized));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          return snapshot.docs[0].data() as StoredUser;
        }
      }
    } catch {
      // Fall back to local JSON storage when Firestore is unavailable.
    }
  }

  const users = await readUsersFile();
  return users.find((user) => user.username.toLowerCase() === normalized) ?? null;
}

export async function createUserRecord(username: string, password_hash: string, password_salt: string): Promise<StoredUser> {
  const normalizedUsername = username.trim().toLowerCase();
  const existingUser = await findUserByUsername(normalizedUsername);

  if (existingUser) {
    throw new Error('Username already exists');
  }

  const user: StoredUser = {
    user_id: createUserId(),
    username: normalizedUsername,
    password_hash,
    password_salt,
    created_at: new Date().toISOString(),
  };

  if (isFirebaseConfigured()) {
    try {
      const db = getFirebaseDb();
      if (db) {
        await setDoc(doc(db, USERS_COLLECTION, user.user_id), user);
        return user;
      }
    } catch {
      // Fall back to local JSON storage when Firestore is unavailable.
    }
  }

  const users = await readUsersFile();
  users.push(user);
  await writeUsersFile(users);
  return user;
}
