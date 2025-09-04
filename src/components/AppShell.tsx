import { Link, Outlet } from 'react-router-dom';
import { Bell, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppShell() {
  return (
    <div className="min-h-screen">
      {/* Top Nav */}
      <header className="sticky top-0 z-40 bg-gradient-to-b from-black/80 to-transparent">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-2xl font-extrabold tracking-tight" style={{ color: '#E50914' }}>
              SummitLine
            </Link>
            <nav className="hidden md:flex items-center gap-5 text-sm text-neutral-300">
              <Link to="/borrower" className="hover:text-white">Borrower</Link>
              <Link to="/admin" className="hover:text-white">Admin</Link>
              <Link to="/analytics" className="hover:text-white">Analytics</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="text-neutral-300 hover:text-white">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" className="text-neutral-300 hover:text-white">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Page container */}
      <main className="mx-auto max-w-7xl px-4 pb-16">
        <Outlet />
      </main>
    </div>
  );
}