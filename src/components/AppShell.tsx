import { Link, Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Bell, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CompactToggle from '@/components/CompactToggle';
import ThemeToggle from '@/components/ThemeToggle';
import { NotificationsProvider, useNotifications } from '@/contexts/NotificationsContext';
import CommandPalette from '@/components/CommandPalette';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

type AppRole = "admin" | "analyst" | "borrower";

function BellMenu() {
  const { items, unreadCount, loading, markAllRead, refresh } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        aria-label="Open notifications"
        variant="ghost"
        className="relative text-foreground/80 hover:text-foreground"
        onClick={() => setOpen(o => !o)}
        title="Notifications"
      >
        <Bell aria-hidden="true" className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            aria-label={`${unreadCount} unread notifications`}
            className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] leading-none px-1.5 py-1 rounded-full"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[90vw] card-surface p-2 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1">
            <div className="text-sm text-muted">{loading ? 'Loading…' : 'Notifications'}</div>
            <div className="flex items-center gap-2">
              <button className="text-xs text-muted hover:text-white" onClick={refresh}>Refresh</button>
              <button className="text-xs text-muted hover:text-white" onClick={markAllRead} disabled={unreadCount===0}>
                Mark all read
              </button>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-auto space-y-2 px-2 pb-2">
            {items.length === 0 && (
              <div className="text-sm text-muted px-2 py-3">No notifications.</div>
            )}
            {items.map(n => (
              <a
                key={n.id}
                href={n.link || '#'}
                className={`block rounded p-3 hover:bg-white/5 transition ${!n.read_at ? 'bg-white/[0.03]' : ''}`}
                onClick={(e) => { if (!n.link) e.preventDefault(); }}
              >
                <div className="text-sm font-semibold">{n.title}</div>
                {n.body && <div className="text-xs text-muted mt-0.5">{n.body}</div>}
                <div className="text-[11px] text-muted mt-1">
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
  const navigate = useNavigate();
  const [role, setRole] = useState<AppRole | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      setRole((data?.role as AppRole) || null);
    })();
  }, []);

  const isLender = role === "admin" || role === "analyst";
  const isBorrower = role === "borrower";

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <NotificationsProvider>
      {/* Skip link for keyboard/screen readers */}
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-[var(--bg)] px-3 py-1 rounded">
        Skip to content
      </a>

      <div className="min-h-screen">
        <header className="sticky top-0 z-40 app-header">
          <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
            <Link to="/" className="text-2xl font-extrabold tracking-tight">
              SummitLine
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-sm overflow-x-auto" aria-label="Primary">
              {isLender && (
                <>
                  <Link
                    to="/admin"
                    aria-current={pathname.startsWith('/admin') ? 'page' : undefined}
                    className={`hover:text-primary whitespace-nowrap transition-colors ${pathname.startsWith('/admin') ? 'text-foreground font-semibold' : 'text-foreground/80'}`}
                  >
                    Admin
                  </Link>
                  <Link
                    to="/admin/dashboard"
                    aria-current={pathname === '/admin/dashboard' ? 'page' : undefined}
                    className={`hover:text-primary whitespace-nowrap transition-colors ${pathname === '/admin/dashboard' ? 'text-foreground font-semibold' : 'text-foreground/80'}`}
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/admin/loans"
                    aria-current={pathname.startsWith('/admin/loans') ? 'page' : undefined}
                    className={`hover:text-primary whitespace-nowrap transition-colors ${pathname.startsWith('/admin/loans') ? 'text-foreground font-semibold' : 'text-foreground/80'}`}
                  >
                    Loans
                  </Link>
                  <Link
                    to="/admin/reports"
                    aria-current={pathname === '/admin/reports' ? 'page' : undefined}
                    className={`hover:text-primary whitespace-nowrap transition-colors ${pathname === '/admin/reports' ? 'text-foreground font-semibold' : 'text-foreground/80'}`}
                  >
                    Reports
                  </Link>
                </>
              )}
              {isBorrower && (
                <Link
                  to="/borrower"
                  aria-current={pathname.startsWith('/borrower') ? 'page' : undefined}
                  className={`hover:text-primary whitespace-nowrap transition-colors ${pathname.startsWith('/borrower') ? 'text-foreground font-semibold' : 'text-foreground/80'}`}
                >
                  My Loans
                </Link>
              )}
            </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <CompactToggle />
            <BellMenu />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-foreground/80 hover:text-foreground"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">Sign out</span>
            </Button>
          </div>
        </div>
        </header>
        <main id="main" role="main" className="mx-auto max-w-7xl px-4 pb-16">
          <Outlet />
        </main>
      <CommandPalette />
    </div>
    </NotificationsProvider>
  );
}