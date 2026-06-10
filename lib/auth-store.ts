import { createUserId, type StoredUser } from './auth';

const USERS_COLLECTION = 'users';
const FIRESTORE_TIMEOUT_MS = 10000;

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

type FirestoreDocument = {
  name?: string;
  fields?: Record<string, FirestoreValue>;
};

type RunQueryResult = {
  document?: FirestoreDocument;
};

function getFirestoreConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!apiKey || !projectId) {
    throw new Error('Database Cloud belum terkonfigurasi dengan benar.');
  }

  return { apiKey, projectId };
}

function getFirestoreBaseUrl(): string {
  const { projectId } = getFirestoreConfig();
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

async function firestoreFetch<T>(url: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FIRESTORE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      cache: 'no-store',
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const message = data?.error?.message || 'Gagal menghubungi Cloud Firestore.';
      throw new Error(message);
    }

    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Koneksi ke Cloud Firestore timeout. Coba lagi beberapa saat.');
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function toFirestoreValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: value.length > 0 ? { values: value.map(toFirestoreValue) } : {} };
  }
  if (typeof value === 'object') {
    const fields = Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [key, toFirestoreValue(nestedValue)]),
    );
    return { mapValue: { fields } };
  }

  return { stringValue: String(value) };
}

function toFirestoreFields(value: Record<string, unknown>): Record<string, FirestoreValue> {
  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [key, toFirestoreValue(nestedValue)]),
  );
}

function fromFirestoreValue(value: FirestoreValue | undefined): unknown {
  if (!value) return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(fromFirestoreValue);
  if ('mapValue' in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields ?? {}).map(([key, nestedValue]) => [key, fromFirestoreValue(nestedValue)]),
    );
  }

  return undefined;
}

function fromFirestoreDocument(document: FirestoreDocument): StoredUser {
  const fields = document.fields ?? {};

  return {
    user_id: String(fromFirestoreValue(fields.user_id) ?? ''),
    username: String(fromFirestoreValue(fields.username) ?? ''),
    password_hash: String(fromFirestoreValue(fields.password_hash) ?? ''),
    password_salt: String(fromFirestoreValue(fields.password_salt) ?? ''),
    created_at: String(fromFirestoreValue(fields.created_at) ?? ''),
  };
}

export async function findUserByUsername(username: string): Promise<StoredUser | null> {
  const normalized = username.trim().toLowerCase();
  const { apiKey } = getFirestoreConfig();
  const url = `${getFirestoreBaseUrl()}:runQuery?key=${apiKey}`;

  const results = await firestoreFetch<RunQueryResult[]>(url, {
    method: 'POST',
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: USERS_COLLECTION }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'username' },
            op: 'EQUAL',
            value: { stringValue: normalized },
          },
        },
        limit: 1,
      },
    }),
  });

  const match = results.find((result) => result.document);
  return match?.document ? fromFirestoreDocument(match.document) : null;
}

export async function createUserRecord(
  username: string,
  password_hash: string,
  password_salt: string,
): Promise<StoredUser> {
  const normalizedUsername = username.trim().toLowerCase();
  const existingUser = await findUserByUsername(normalizedUsername);

  if (existingUser) {
    throw new Error('Username sudah terdaftar');
  }

  const user: StoredUser = {
    user_id: createUserId(),
    username: normalizedUsername,
    password_hash,
    password_salt,
    created_at: new Date().toISOString(),
  };

  const { apiKey } = getFirestoreConfig();
  const url = `${getFirestoreBaseUrl()}/${USERS_COLLECTION}/${encodeURIComponent(user.user_id)}?key=${apiKey}`;

  await firestoreFetch<FirestoreDocument>(url, {
    method: 'PATCH',
    body: JSON.stringify({
      fields: toFirestoreFields({
        ...user,
        modelTrainingStatus: 'idle',
        menuList: [],
        salesHistory: [],
        stockData: {},
        wasteLog: [],
      }),
    }),
  });

  return user;
}
