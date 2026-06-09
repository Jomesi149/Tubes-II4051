'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading, register } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

    if (password.length < 6) {
      setMessage('Password minimal 6 karakter');
      setIsSubmitting(false);
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Konfirmasi password tidak cocok');
      setIsSubmitting(false);
      return;
    }

    const result = await register(username.trim(), password);
    if (result.ok) {
      router.replace('/');
      return;
    }

    setMessage(result.message || 'Registrasi gagal');
    setIsSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-hairline bg-surface-1 p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Daftar</p>
        <h1 className="mt-3 text-2xl font-semibold text-ink">Buat akun Ventoré</h1>
        <p className="mt-3 text-sm leading-6 text-ink-subtle">
          Daftarkan akun Anda.
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
              placeholder="contoh: ventore_user"
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
              placeholder="Minimal 6 karakter"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink" htmlFor="confirmPassword">
              Konfirmasi Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-lg border border-hairline bg-canvas px-3 py-2 text-sm outline-none ring-0"
              placeholder="Ulangi password"
              required
            />
          </div>

          {message ? <p className="text-sm text-red-600">{message}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Membuat akun…' : 'Daftar'}
          </button>
        </form>

        <p className="mt-5 text-sm text-ink-subtle">
          Sudah punya akun?{' '}
          <Link href="/login" className="font-semibold text-primary">
            Masuk di sini
          </Link>
        </p>
      </div>
    </div>
  );
}
