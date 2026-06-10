import { NextResponse } from 'next/server';
import { createUserRecord, findUserByUsername } from '@/lib/auth-store';
import { hashPassword, sanitizeUser } from '@/lib/auth';
// Tambahan untuk Firebase
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: Request) {
  try {
    const text = await request.text();
    let body: Record<string, unknown> = {};

    if (text) {
      try {
        body = JSON.parse(text) as Record<string, unknown>;
      } catch {
        return NextResponse.json({ message: 'Payload JSON tidak valid' }, { status: 400 });
      }
    }

    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!username || !password) {
      return NextResponse.json({ message: 'Username dan password wajib diisi' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ message: 'Password minimal 6 karakter' }, { status: 400 });
    }

    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      return NextResponse.json({ message: 'Username sudah terdaftar' }, { status: 409 });
    }

    const { password_hash, password_salt } = hashPassword(password);
    const user = await createUserRecord(username, password_hash, password_salt);

    // SINKRONISASI OTOMATIS KE FIREBASE CLOUD
    try {
      if (db) {
        await setDoc(doc(db, 'users', user.user_id), {
          username: user.username,
          createdAt: new Date().toISOString(),
          modelTrainingStatus: 'idle',
          menuList: [],
          salesHistory: [],
          stockData: {},
          wasteLog: []
        });
      }
    } catch (firebaseErr) {
      console.error("Gagal sinkronisasi user ke Firebase:", firebaseErr);
      // Registrasi tetap dianggap sukses walau sinkron cloud gagal
    }

    return NextResponse.json({ user: sanitizeUser(user) }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Registrasi gagal' }, { status: 500 });
  }
}