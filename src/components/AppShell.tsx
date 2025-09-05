import { Link, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CompactToggle from '@/components/CompactToggle';
import { NotificationsProvider, useNotifications } from '@/contexts/NotificationsContext';
import CommandPalette from '@/components/CommandPalette';

function BellMenu() {
  const { items, unreadCount, loading, markAllRead, refresh } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        className="relative text-neutral-300 hover:text-white"
        onClick={() => setOpen(o => !o)}
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] leading-none px-1.5 py-1 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[90vw] card-surface p-2 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1">
            <div className="text-sm text-neutral-300">{loading ? 'Loading…' : 'Notifications'}</div>
            <div className="flex items-center gap-2">
              <button className="text-xs text-neutral-300 hover:text-white" onClick={refresh}>Refresh</button>
              <button className="text-xs text-neutral-300 hover:text-white" onClick={markAllRead} disabled={unreadCount===0}>
                Mark all read
              </button>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-auto space-y-2 px-2 pb-2">
            {items.length === 0 && (
              <div className="text-sm text-neutral-400 px-2 py-3">No notifications.</div>
            )}
            {items.map(n => (
              <a
                key={n.id}
                href={n.link || '#'}
                className={`block rounded p-3 hover:bg-white/5 transition ${!n.read_at ? 'bg-white/[0.03]' : ''}`}
                onClick={(e) => { if (!n.link) e.preventDefault(); }}
              >
                <div className="text-sm font-semibold">{n.title}</div>
                {n.body && <div className="text-xs text-neutral-400 mt-0.5">{n.body}</div>}
                <div className="text-[11px] text-neutral-500 mt-1">
                  {new Date(n.created_at).toLocaleString()}
                  {!n.read_at && <span className="ml-2 text-red-400">• new</span>}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppShell() {
  const { pathname } = useLocation();
  const tabs = [
    { to: '/borrower', label: 'Borrower' },
    { to: '/admin',    label: 'Admin' },
    { to: '/analytics',label: 'Analytics' },
  ];
  return (
    <NotificationsProvider>
      <div className="min-h-screen">
      <header className="sticky top-0 z-40 bg-gradient-to-b from-black/80 to-transparent">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-2xl font-extrabold tracking-tight text-white">
            SummitLine
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-neutral-300">
            {tabs.map(t => (
              <Link key={t.to} to={t.to}
                className={`hover:text-white ${pathname.startsWith(t.to) ? 'text-white font-semibold' : ''}`}>
                {t.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <CompactToggle />
            <BellMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-16">
        <Outlet />
      </main>
      <CommandPalette />
    </div>
    </NotificationsProvider>
  );
}