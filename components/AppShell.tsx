'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const isAuthRoute = pathname === '/login' || pathname === '/register';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
        <div className="rounded-2xl border border-hairline bg-surface-1 px-8 py-6 text-center shadow-sm">
          <p className="text-sm font-medium text-ink-subtle">Memuat sesi akun…</p>
        </div>
      </div>
    );
  }

  if (!user && !isAuthRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-6 py-16">
        <div className="w-full max-w-md rounded-2xl border border-hairline bg-surface-1 p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Akses Terbatas</p>
          <h1 className="mt-3 text-2xl font-semibold text-ink">Masuk ke Ventoré</h1>
          <p className="mt-3 text-sm leading-6 text-ink-subtle">
            Silakan login atau buat akun untuk mengakses dashboard prediksi, stok, dan penjualan.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="rounded-lg bg-primary px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-primary/90"
            >
              Masuk
            </Link>
            <Link
              href="/register"
              className="rounded-lg border border-hairline px-4 py-2 text-center text-sm font-semibold text-ink transition hover:bg-surface-2"
            >
              Daftar
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
