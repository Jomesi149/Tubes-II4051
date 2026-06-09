import { NextResponse } from 'next/server';
import { findUserByUsername } from '@/lib/auth-store';
import { sanitizeUser, verifyPassword } from '@/lib/auth';

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

    const user = await findUserByUsername(username);
    if (!user) {
      return NextResponse.json({ message: 'Username atau password salah' }, { status: 401 });
    }

    const isValid = verifyPassword(password, user.password_hash, user.password_salt);
    if (!isValid) {
      return NextResponse.json({ message: 'Username atau password salah' }, { status: 401 });
    }

    return NextResponse.json({ user: sanitizeUser(user) }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Login gagal' }, { status: 500 });
  }
}
