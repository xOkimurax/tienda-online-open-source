import { Icon } from './Icon';

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-4)', fontSize: 12.5 }}>
      <span style={{ opacity: 0.6 }}>{from}–{to} de {total}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          aria-label="Página anterior"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <Icon path='<path d="M15 18l-6-6 6-6"/>' size={14} strokeWidth={2.5} />
        </button>
        <span style={{ opacity: 0.75 }}>Página {page} de {totalPages}</span>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          aria-label="Página siguiente"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <Icon path='<path d="M9 18l6-6-6-6"/>' size={14} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
