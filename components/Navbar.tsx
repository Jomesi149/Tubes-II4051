'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: '◈' },
  { href: '/recommendation', label: 'Prediksi Model', icon: '◉' },
  { href: '/sales', label: 'Input Penjualan', icon: '◎' },
  { href: '/stock', label: 'Stok & Alert', icon: '◬' },
  { href: '/waste', label: 'Log Waste', icon: '◌' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-4 border-b border-hairline bg-canvas">
        <span className="text-primary font-semibold tracking-tight mr-auto">Ventoré</span>
        <button
          onClick={() => setOpen(!open)}
          className="w-8 h-8 flex flex-col justify-center gap-[5px] items-center"
          aria-label="Toggle menu"
        >
          <span className={`block w-5 h-px bg-ink transition-all ${open ? 'rotate-45 translate-y-[6px]' : ''}`} />
          <span className={`block w-5 h-px bg-ink transition-all ${open ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-px bg-ink transition-all ${open ? '-rotate-45 -translate-y-[6px]' : ''}`} />
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setOpen(false)}
        >
          <nav
            className="absolute left-0 top-0 h-full w-60 bg-surface-1 border-r border-hairline pt-14"
            onClick={(e) => e.stopPropagation()}
          >
            <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
          </nav>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-hairline bg-canvas sticky top-0 h-screen">
        <div className="h-14 flex items-center px-6 border-b border-hairline">
          <span className="text-primary font-semibold text-[15px] tracking-tight">Ventoré</span>
          <span className="ml-2 text-[10px] font-medium text-ink-tertiary tracking-widest uppercase">MVP</span>
        </div>
        <nav className="flex-1 py-4">
          <NavLinks pathname={pathname} />
        </nav>
        <div className="px-6 py-4 border-t border-hairline">
          <p className="text-[11px] text-ink-tertiary">F&B Ops · v0.1.0</p>
        </div>
      </aside>
    </>
  );
}

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-0.5 px-3">
      {NAV_ITEMS.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-[14px] transition-colors ${
                active
                  ? 'bg-surface-2 text-ink'
                  : 'text-ink-subtle hover:text-ink hover:bg-surface-2/50'
              }`}
            >
              <span className="text-[16px] leading-none">{item.icon}</span>
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
