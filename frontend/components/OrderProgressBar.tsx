'use client';

import { Icon } from './Icon';
import { OrderStatus } from '@/lib/types';

const STAGES = [
  { label: 'Pedido confirmado' },
  { label: 'Pago confirmado' },
  { label: 'Enviado' },
  { label: 'Entregado' },
];

// All four stages render from the start — future ones just show locked,
// they don't appear one at a time as the order progresses. This is
// deliberate: it lets the customer see the whole journey ahead of time and
// understand what each upcoming status will mean, not just what already
// happened.
function stageIndexFor(estado: OrderStatus): number {
  if (estado === 'PAGO_CONFIRMADO') return 1;
  if (estado === 'ENVIADO') return 2;
  if (estado === 'ENTREGADO') return 3;
  return 0; // VERIFICANDO_EXISTENCIA / PENDIENTE / PROCESANDO are all still "before payment confirmed"
}

const CHECK_ICON = '<path d="M20 6 9 17l-5-5"/>';
const LOCK_ICON = '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>';

export function OrderProgressBar({ estado }: { estado: OrderStatus }) {
  if (estado === 'CANCELADO' || estado === 'REEMBOLSADO') {
    return (
      <div style={{ padding: 14, background: 'var(--color-neutral-100)', borderRadius: 'var(--radius-md)', fontSize: 13.5 }}>
        Este pedido fue {estado === 'CANCELADO' ? 'cancelado' : 'reembolsado'} — ya no sigue el circuito normal de entrega.
      </div>
    );
  }

  const current = stageIndexFor(estado);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', padding: 'var(--space-2) 0' }}>
      {STAGES.map((stage, i) => {
        const done = i < current;
        const active = i === current;
        const locked = i > current;
        return (
          <div key={stage.label} style={{ display: 'flex', alignItems: 'flex-start', flex: i < STAGES.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 96 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  flex: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: done || active ? 'var(--color-accent)' : 'var(--color-neutral-200)',
                  border: active ? '3px solid var(--color-accent-300)' : 'none',
                }}
              >
                {locked ? (
                  <Icon path={LOCK_ICON} size={13} stroke="var(--color-neutral-500)" strokeWidth={2} />
                ) : done ? (
                  <Icon path={CHECK_ICON} size={15} stroke="#fff" strokeWidth={3} />
                ) : (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />
                )}
              </div>
              <span
                style={{
                  fontSize: 11.5,
                  textAlign: 'center',
                  marginTop: 8,
                  lineHeight: 1.3,
                  color: locked ? 'var(--color-neutral-500)' : 'var(--color-text)',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {stage.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  marginTop: 15,
                  background: i < current ? 'var(--color-accent)' : 'var(--color-neutral-200)',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
