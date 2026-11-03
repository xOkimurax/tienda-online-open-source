'use client';

import { useRef } from 'react';
import { Icon } from './Icon';

export type ManagedImage = { id: string; url: string };

export function ProductImageManager({
  images,
  onAddFiles,
  onDelete,
  onReorder,
  uploading = false,
}: {
  images: ManagedImage[];
  onAddFiles: (files: FileList) => void;
  onDelete: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
  uploading?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragIndex = useRef<number | null>(null);

  function move(from: number, to: number) {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onReorder(next.map((img) => img.id));
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 10 }}>
        {images.map((img, i) => (
          <div
            key={img.id}
            draggable
            onDragStart={() => { dragIndex.current = i; }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex.current !== null && dragIndex.current !== i) move(dragIndex.current, i);
              dragIndex.current = null;
            }}
            style={{
              position: 'relative',
              aspectRatio: '1',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              backgroundImage: `url(${img.url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundColor: 'var(--color-accent-100)',
              cursor: 'grab',
              border: i === 0 ? '2px solid var(--color-accent)' : '1px solid var(--color-divider)',
            }}
          >
            {i === 0 && (
              <span
                className="tag tag-accent"
                style={{ position: 'absolute', top: 4, left: 4, fontSize: 9.5, padding: '2px 7px' }}
              >
                Principal
              </span>
            )}
            <button
              type="button"
              aria-label="Quitar imagen"
              onClick={() => onDelete(img.id)}
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 22,
                height: 22,
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
              <Icon path='<path d="M18 6 6 18"/><path d="M6 6l12 12"/>' size={11} stroke="#fff" strokeWidth={3} />
            </button>
            <div style={{ position: 'absolute', bottom: 4, left: 4, right: 4, display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                aria-label="Mover antes"
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
                style={{
                  width: 20, height: 20, borderRadius: '50%', border: 'none',
                  cursor: i === 0 ? 'default' : 'pointer', background: 'rgba(32,30,29,.65)', color: '#fff',
                  opacity: i === 0 ? 0.35 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icon path='<path d="M15 18l-6-6 6-6"/>' size={11} stroke="#fff" strokeWidth={3} />
              </button>
              <button
                type="button"
                aria-label="Mover después"
                disabled={i === images.length - 1}
                onClick={() => move(i, i + 1)}
                style={{
                  width: 20, height: 20, borderRadius: '50%', border: 'none',
                  cursor: i === images.length - 1 ? 'default' : 'pointer', background: 'rgba(32,30,29,.65)', color: '#fff',
                  opacity: i === images.length - 1 ? 0.35 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icon path='<path d="M9 18l6-6-6-6"/>' size={11} stroke="#fff" strokeWidth={3} />
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          style={{
            aspectRatio: '1',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--color-neutral-400)',
            background: 'transparent',
            cursor: uploading ? 'default' : 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            color: 'var(--color-accent-700)',
            opacity: uploading ? 0.5 : 1,
          }}
        >
          <Icon path='<path d="M12 5v14"/><path d="M5 12h14"/>' size={18} strokeWidth={2.25} />
          <span style={{ fontSize: 11 }}>{uploading ? 'Subiendo…' : 'Agregar'}</span>
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files?.length) onAddFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {images.length > 0 && (
        <p style={{ fontSize: 11, opacity: 0.55, margin: '8px 0 0' }}>
          Arrastrá para reordenar o usá las flechitas — la primera es la que se muestra en la tienda.
        </p>
      )}
    </div>
  );
}
