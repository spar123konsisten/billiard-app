'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();

  const items = [
    { href: '/home', label: 'Home', icon: '🏠' },
    { href: '/ranking', label: 'Ranking', icon: '🏆' },
    { href: '/pertandingan', label: 'Pertandingan', icon: '⚔️' },
    { href: '/akun', label: 'Akun', icon: '👤' },
  ];

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        width: '100%',
        maxWidth: '420px',
        margin: '0 auto',
        background: '#fff',
        borderTop: '0.5px solid #e5e5e5',
        padding: '8px 16px 12px',
        display: 'flex',
        justifyContent: 'space-around',
        zIndex: 9999,
        boxSizing: 'border-box',
      }}
    >
      {items.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link key={item.href} href={item.href} style={{ textDecoration: 'none', textAlign: 'center' }}>
            <div style={{ textAlign: 'center', cursor: 'pointer' }}>
              <div style={{ fontSize: '20px', filter: isActive ? 'grayscale(0)' : 'grayscale(1)' }}>
                {item.icon}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: isActive ? '600' : '400',
                  color: isActive ? '#000' : '#888',
                  marginTop: '2px',
                }}
              >
                {item.label}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}