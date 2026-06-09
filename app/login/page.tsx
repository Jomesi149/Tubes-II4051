'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace('/');
    }
  }, [loading, router, user]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');

    const result = await login(username.trim(), password);
    if (result.ok) {
      router.replace('/');
      return;
    }

    setMessage(result.message || 'Login gagal');
    setIsSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-hairline bg-surface-1 p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Masuk</p>
        <h1 className="mt-3 text-2xl font-semibold text-ink">Selamat datang kembali</h1>
        <p className="mt-3 text-sm leading-6 text-ink-subtle">
          Masukkan username dan password Anda untuk mengakses Ventoré.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-ink" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm outline-none ring-0"
              placeholder="contoh: admin"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm outline-none ring-0"
              placeholder="Masukkan password"
              required
            />
          </div>

          {message ? <p className="text-sm text-red-600">{message}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Memproses…' : 'Masuk'}
          </button>
        </form>

        <p className="mt-5 text-sm text-ink-subtle">
          Belum punya akun?{' '}
          <Link href="/register" className="font-semibold text-primary">
            Daftar sekarang
          </Link>
        </p>
      </div>
    </div>
  );
}
