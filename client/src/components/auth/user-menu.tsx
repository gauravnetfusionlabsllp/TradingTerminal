import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../stores/use-auth-store';
import { useAuthActions } from '../../api/hooks/use-auth';
import { useT } from '../../i18n';
import { LogOut, User, Download, Trash2 } from 'lucide-react';
import { API_BASE } from '../../api/client';

export function UserMenu() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const setLoginModalOpen = useAuthStore((s) => s.setLoginModalOpen);
  const { logout } = useAuthActions();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  if (!user) {
    return (
      <button
        onClick={() => setLoginModalOpen(true)}
        className="flex items-center h-7 px-3 rounded-sm bg-accent text-on-accent text-xs font-semibold hover:bg-accent/90 transition-colors"
      >
        {t('login')}
      </button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-1.5 h-7 px-2 rounded-sm border border-border bg-raised text-xs text-fg hover:border-neutral/50"
      >
        <User className="w-3.5 h-3.5 text-neutral" />
        <span className="max-w-[100px] truncate">
          {user.name || `#${user.mt5Login}`}
        </span>
        {user.readOnly && <span className="text-micro text-orange">{t('readOnly')}</span>}
      </button>

      {/* Dropdown */}
      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-raised border border-border rounded-sm shadow-[0_12px_32px_rgb(0_0_0/0.3)] py-1 z-50">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-mini text-neutral truncate">MT5 #{user.mt5Login}{user.readOnly ? ` · ${t('readOnly')}` : ''}</p>
          </div>

          <button
            onClick={async () => {
              setMenuOpen(false);
              try {
                const res = await fetch(`${API_BASE}/auth/me/export`, { credentials: 'include' });
                const data = await res.json();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'my-data-export.json';
                a.click();
                URL.revokeObjectURL(url);
              } catch { /* ignore */ }
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-fg hover:bg-hover text-left"
          >
            <Download className="w-3.5 h-3.5 text-neutral" />
            {t('exportData')}
          </button>

          <button
            onClick={async () => {
              if (!confirm(t('deleteAccountConfirm'))) return;
              setMenuOpen(false);
              try {
                await fetch(`${API_BASE}/auth/me`, { method: 'DELETE', credentials: 'include' });
                logout();
              } catch { /* ignore */ }
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-fg hover:text-bearish hover:bg-bearish/10 text-left"
          >
            <Trash2 className="w-3.5 h-3.5 text-neutral" />
            {t('deleteAccount')}
          </button>

          <button
            onClick={() => { logout(); setMenuOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-fg hover:text-bearish hover:bg-bearish/10 text-left border-t border-border"
          >
            <LogOut className="w-3.5 h-3.5 text-neutral" />
            {t('logout')}
          </button>
        </div>
      )}
    </div>
  );
}
