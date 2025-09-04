import { Link, Outlet, useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppShell() {
  const { pathname } = useLocation();
  const tabs = [
    { to: '/borrower', label: 'Borrower' },
    { to: '/admin',    label: 'Admin' },
    { to: '/analytics',label: 'Analytics' },
  ];
  return (
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
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="text-neutral-300 hover:text-white" title="Notifications">
              <Bell className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-16">
        <Outlet />
      </main>
    </div>
  );
}