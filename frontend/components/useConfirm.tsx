'use client';

import { useCallback, useRef, useState } from 'react';
import { Dialog } from './Dialog';

// Usage: const { confirm, dialog } = useConfirm(); ... if (!(await confirm('¿Eliminar X?'))) return;
export function useConfirm() {
  const [message, setMessage] = useState<string | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((msg: string) => {
    setMessage(msg);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function settle(result: boolean) {
    setMessage(null);
    resolver.current?.(result);
    resolver.current = null;
  }

  const dialog =
    message !== null ? (
      <Dialog
        title="¿Estás seguro?"
        width={400}
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => settle(false)}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={() => settle(true)}>Eliminar</button>
          </>
        }
      >
        <p style={{ margin: 0 }}>{message}</p>
      </Dialog>
    ) : null;

  return { confirm, dialog };
}
