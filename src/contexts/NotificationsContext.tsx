import { createContext, useContext, useEffect, useMemo, useState, PropsWithChildren } from 'react';
import { supabase } from '@/integrations/supabase/client';

type Notif = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

type Ctx = {
  loading: boolean;
  items: Notif[];
  unreadCount: number;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationsContext = createContext<Ctx | null>(null);

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('NotificationsProvider missing');
  return ctx;
}

export function NotificationsProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const unreadCount = useMemo(() => items.filter(n => !n.read_at).length, [items]);

  async function refresh() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setItems([]); return; }
      // Load latest 50, unread first
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('read_at', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error) setItems(data || []);
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null);
    await refresh();
  }

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let alive = true;

    (async () => {
      await refresh();

      // Subscribe to inserts/updates for current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel('notif-stream')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          async (payload) => {
            // Minimal merge strategy
            if (!alive) return;
            if (payload.eventType === 'INSERT') {
              setItems(prev => [payload.new as Notif, ...prev].slice(0, 50));
            } else if (payload.eventType === 'UPDATE') {
              setItems(prev => {
                const idx = prev.findIndex(n => n.id === (payload.new as any).id);
                if (idx === -1) return prev;
                const copy = prev.slice();
                copy[idx] = payload.new as Notif;
                return copy;
              });
            } else if (payload.eventType === 'DELETE') {
              setItems(prev => prev.filter(n => n.id !== (payload.old as any).id));
            }
          }
        )
        .subscribe();
    })();

    return () => {
      alive = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const value: Ctx = { loading, items, unreadCount, refresh, markAllRead };
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}