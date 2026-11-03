'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { CLOSE_ICON } from '@/lib/icons';

// Mirrors ProductImageManager's visual language (dashed drop tile, circular
// remove button) for the checkout's single comprobante file instead of the
// bare <input type=file> it used to be.
export function ComprobanteUploader({ file, onSelect, onRemove }: { file: File | null; onSelect: (file: File) => void; onRemove: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div>
      {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{
            width: '100%',
            padding: '22px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--color-neutral-400)',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            color: 'var(--color-accent-700)',
          }}
        >
          <Icon path='<path d="M12 5v14"/><path d="M5 12h14"/>' size={20} strokeWidth={2.25} />
          <span style={{ fontSize: 12.5 }}>Subir comprobante (imagen o PDF)</span>
        </button>
      ) : (
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 10,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-divider)',
          }}
        >
          {previewUrl ? (
            <div
              className="washed"
              style={{ width: 48, height: 48, flex: 'none', borderRadius: 'var(--radius-sm)', backgroundImage: `url(${previewUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            />
          ) : (
            <div style={{ width: 48, height: 48, flex: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--color-accent-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon path='<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>' size={20} stroke="var(--color-accent-700)" strokeWidth={1.8} />
            </div>
          )}
          <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
          <button
            type="button"
            aria-label="Quitar comprobante"
            onClick={onRemove}
            style={{
              marginLeft: 'auto',
              flex: 'none',
              width: 24,
              height: 24,
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              background: 'rgba(32,30,29,.65)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon path={CLOSE_ICON} size={11} stroke="#fff" strokeWidth={3} />
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onSelect(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
