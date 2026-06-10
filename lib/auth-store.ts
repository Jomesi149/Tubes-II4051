import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { getFirebaseDb, isFirebaseConfigured } from './firebase';
import { createUserId, type StoredUser } from './auth';

const USERS_COLLECTION = 'users';

/**
 * Mencari data user langsung dari Cloud Firestore berdasarkan username secara asinkron
 */
export async function findUserByUsername(username: string): Promise<StoredUser | null> {
  console.log("findUserByUsername Cloud Firestore Start");

  const normalized = username.trim().toLowerCase();

  if (isFirebaseConfigured()) {
    try {
      const db = getFirebaseDb();
      if (db) {
        // Melakukan query langsung ke Cloud Firestore koleksi 'users'
        const q = query(
          collection(db, USERS_COLLECTION),
          where("username", "==", normalized)
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          console.log("User ditemukan di Cloud Firestore");
          return snapshot.docs[0].data() as StoredUser;
        }
      }
    } catch (e) {
      console.error("Gagal melakukan query findUserByUsername ke Firestore:", e);
      throw new Error("Terjadi masalah koneksi database cloud saat memeriksa username.");
    }
  } else {
    console.error("Firebase tidak terkonfigurasi! Pastikan ENV sudah dimasukkan ke Vercel.");
    throw new Error("Database Cloud belum terkonfigurasi dengan benar.");
  }

  return null;
}

/**
 * Membuat data user baru dan langsung menyimpannya ke Cloud Firestore secara terpusat
 */
export async function createUserRecord(
  username: string, 
  password_hash: string, 
  password_salt: string
): Promise<StoredUser> {
  console.log("createUserRecord Cloud Firestore Start");
  
  const normalizedUsername = username.trim().toLowerCase();
  
  // Memastikan keunikan username langsung via query Cloud Firestore
  const existingUser = await findUserByUsername(normalizedUsername);
  if (existingUser) {
    throw new Error('Username sudah terdaftar');
  }

  // Membuat struktur data user terstandarisasi dengan ID unik terkomputerisasi
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
        // Menyimpan data akun baru dengan kunci dokumen berbasis user_id
        const userDocRef = doc(db, USERS_COLLECTION, user.user_id);
        await setDoc(userDocRef, user);
        console.log("User baru berhasil didaftarkan di Cloud Firestore:", user.user_id);
        return user;
      }
    } catch (e) {
      console.error("Gagal menulis dokumen user baru ke Firestore:", e);
      throw new Error("Gagal mengamankan data akun baru ke Cloud database.");
    }
  }

  throw new Error('Gagal memproses registrasi karena koneksi Cloud database terputus.');
}