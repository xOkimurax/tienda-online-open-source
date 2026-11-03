'use client';

import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';
import { Icon } from '@/components/Icon';

type ToastKind = 'success' | 'error';
type ToastState = { msg: string; kind: ToastKind };
type FlashFn = (msg: string, kind?: ToastKind) => void;

const ToastContext = createContext<FlashFn | null>(null);

const CHECK_ICON = '<path d="M20 6 9 17l-5-5"/>';
const ALERT_ICON = '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>';

const KIND_STYLE: Record<ToastKind, { bg: string; stroke: string; icon: string }> = {
  success: { bg: 'var(--color-accent-2-100)', stroke: 'var(--color-accent-2-700)', icon: CHECK_ICON },
  error: { bg: 'var(--color-accent-100)', stroke: 'var(--color-accent-700)', icon: ALERT_ICON },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flash = useCallback<FlashFn>((msg, kind = 'success') => {
    setToast({ msg, kind });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const style = toast ? KIND_STYLE[toast.kind] : null;

  return (
    <ToastContext.Provider value={flash}>
      {children}
      {toast && style && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: 28,
            zIndex: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--color-neutral-100)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-divider)',
            padding: '10px 18px 10px 12px',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            fontSize: 13.5,
            fontWeight: 500,
            maxWidth: 360,
            animation: 'toastIn .22s ease',
          }}
        >
          <span
            style={{
              flex: 'none',
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: style.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon path={style.icon} size={14} stroke={style.stroke} strokeWidth={2.75} />
          </span>
          {toast.msg}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
