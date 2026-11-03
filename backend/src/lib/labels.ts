import { AdminRole, OrderStatus } from '@prisma/client';

// Mirrors frontend/lib/types.ts's CUSTOMER_ORDER_STATE_LABEL — kept as a
// separate copy since the backend can't import from the frontend package,
// but the wording must stay in sync so emails and the account page agree.
export const CUSTOMER_ORDER_STATE_LABEL: Record<OrderStatus, string> = {
  VERIFICANDO_EXISTENCIA: 'En verificación',
  PENDIENTE: 'Pendiente de pago',
  PROCESANDO: 'Pago en revisión',
  PAGO_CONFIRMADO: 'Pagado',
  ENVIADO: 'Enviado',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
  REEMBOLSADO: 'Reembolsado',
};

// Mirrors frontend/lib/types.ts's ADMIN_ROLE_LABEL, used in invite emails.
export const ADMIN_ROLE_LABEL: Record<AdminRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  EDITOR_CATALOGO: 'Editor de catálogo',
  SOPORTE: 'Soporte',
};

// Mirrors the wording used in frontend/app/(store)/pedidos/[id]/page.tsx.
export const METODO_PAGO_LABEL: Record<string, string> = {
  TARJETA: 'Tarjeta (Stripe)',
  TRANSFERENCIA: 'Transferencia bancaria',
};
