export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number };

export type Category = { id: string; nombre: string; subcategorias: { id: string; nombre: string }[]; count?: number };
export type Supplier = { id: string; nombre: string; contacto: string; telefono: string; count?: number };

export type ProductVariant = { id: string; tipo: string; valores: string[] };
export type ProductImage = { id: string; url: string; orden: number };

export type Product = {
  id: string;
  codigo: string;
  nombre: string;
  marca: string;
  descripcion: string;
  // "Por unidad" price — always tracked, even on pack-only products (useful
  // for costing/margin) even though they never sell it directly.
  precio: number;
  precioCosto: number;
  // "Por paquete" price — only meaningful when ventaConjuntoActivo.
  precioPaquete: number;
  precioCostoPaquete: number;
  // `stock` counts whole packs when ventaConjuntoActivo, plain units
  // otherwise; unidadesSueltas holds loose units left over from a broken
  // pack. `stockDisponible` (server-computed) is always the total sellable
  // units and is what customer-facing stock checks should use.
  stock: number;
  unidadesSueltas: number;
  stockMinimo: number;
  stockDisponible?: number;
  icon: string;
  requiereVerificacion: boolean;
  destacado: boolean;
  ventaConjuntoActivo: boolean;
  // Only meaningful when ventaConjuntoActivo — false means "solo por
  // paquete" (no loose-unit sales, no unidadesSueltas, storefront never
  // offers a per-unit purchase option for this product).
  ventaUnidadActiva: boolean;
  ventaConjuntoUnidades: number;
  categoryId: string;
  subcategoryId: string | null;
  supplierId: string | null;
  category?: Category;
  subcategory?: { id: string; nombre: string } | null;
  supplier?: Supplier | null;
  variantes: ProductVariant[];
  imagenes: ProductImage[];
};

export type StockProblem = { productId: string; nombre: string; disponible: number; solicitado: number };

export type RestockTipo = 'UNIDADES' | 'PAQUETES';
export type Restock = {
  id: string;
  productId: string;
  tipo: RestockTipo;
  cantidad: number;
  unidadesAgregadas: number;
  precioCosto: number | null;
  precioVenta: number | null;
  createdAt: string;
  product: { nombre: string; codigo: string };
  adminUser: { nombre: string } | null;
};

export type VentaModo = 'UNIDAD' | 'PAQUETE';

export type OrderStatus =
  | 'VERIFICANDO_EXISTENCIA'
  | 'PENDIENTE'
  | 'PROCESANDO'
  | 'PAGO_CONFIRMADO'
  | 'ENVIADO'
  | 'ENTREGADO'
  | 'CANCELADO'
  | 'REEMBOLSADO';

export const ORDER_STATES: OrderStatus[] = [
  'VERIFICANDO_EXISTENCIA',
  'PENDIENTE',
  'PROCESANDO',
  'PAGO_CONFIRMADO',
  'ENVIADO',
  'ENTREGADO',
  'CANCELADO',
  'REEMBOLSADO',
];

export const ORDER_STATE_LABEL: Record<OrderStatus, string> = {
  VERIFICANDO_EXISTENCIA: 'Verificando existencia',
  PENDIENTE: 'Pendiente',
  PROCESANDO: 'Procesando',
  PAGO_CONFIRMADO: 'Pago confirmado',
  ENVIADO: 'Enviado',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
  REEMBOLSADO: 'Reembolsado',
};

export const ORDER_STATE_TAG_CLASS: Record<OrderStatus, string> = {
  VERIFICANDO_EXISTENCIA: 'tag-outline',
  PENDIENTE: 'tag-neutral',
  PROCESANDO: 'tag-accent-2',
  PAGO_CONFIRMADO: 'tag-accent',
  ENVIADO: 'tag-accent-2',
  ENTREGADO: 'tag-accent',
  CANCELADO: 'tag-neutral',
  REEMBOLSADO: 'tag-neutral',
};

// Customer-facing phrasing — friendlier than the admin's ORDER_STATE_LABEL
// (e.g. "Pago en revisión" instead of "Procesando").
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

export type OrderItem = {
  id: string;
  productId: string | null;
  nombre: string;
  variante: string;
  tipoVenta: VentaModo;
  cantidad: number;
  precio: number;
  // Current product snapshot — not the price/nombre at sale time — used
  // only for the admin review dialog's photo/código/categoría display, so
  // it's absent (product deleted since) or partial without breaking anything.
  product?: { codigo: string; category: { nombre: string } | null; imagenes: { id: string; url: string; orden: number }[] } | null;
};

export type TipoEntrega = 'RETIRO_LOCAL' | 'ENVIO_DOMICILIO';

export type CustomerAddress = {
  id: string;
  nombre: string;
  ci: string;
  celular: string;
  ciudad: string;
  barrio: string;
  esPredeterminada: boolean;
};

export type Order = {
  id: string;
  numero: string;
  estado: OrderStatus;
  metodoPago: 'TARJETA' | 'TRANSFERENCIA' | null;
  comprobanteUrl: string | null;
  total: number;
  couponCode: string | null;
  createdAt: string;
  customer: { id: string; nombre: string; email: string } | null;
  items: OrderItem[];
  tipoEntrega: TipoEntrega;
  envioNombre: string | null;
  envioCi: string | null;
  envioCelular: string | null;
  envioCiudad: string | null;
  envioBarrio: string | null;
};

export type CouponType = 'PORCENTAJE' | 'MONTO_FIJO' | 'ENVIO_GRATIS';
export type CouponScope = 'TODOS' | 'PRODUCTOS';

export type Coupon = {
  id: string;
  codigo: string;
  tipo: CouponType;
  valor: number;
  activo: boolean;
  usos: number;
  alcance: CouponScope;
  productos: string[];
};

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR_CATALOGO' | 'SOPORTE';
export const ADMIN_ROLES: AdminRole[] = ['SUPER_ADMIN', 'ADMIN', 'EDITOR_CATALOGO', 'SOPORTE'];
export const ADMIN_ROLE_LABEL: Record<AdminRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  EDITOR_CATALOGO: 'Editor de catálogo',
  SOPORTE: 'Soporte',
};

// Mirrors backend/src/routes/admin/users.routes.ts — a manager can only
// touch users (and assign roles) strictly below their own rank; Super Admin
// bypasses the check entirely.
export const ADMIN_ROLE_RANK: Record<AdminRole, number> = {
  SUPER_ADMIN: 3,
  ADMIN: 2,
  EDITOR_CATALOGO: 1,
  SOPORTE: 1,
};
export function canManageAdminRole(actingRole: AdminRole, targetRole: AdminRole) {
  if (actingRole === 'SUPER_ADMIN') return true;
  return ADMIN_ROLE_RANK[targetRole] < ADMIN_ROLE_RANK[actingRole];
}

export type AdminUserRow = { id: string; nombre: string; email: string; rol: AdminRole; activo: boolean };

export type Tema = 'DEFAULT' | 'MONO_EDITORIAL' | 'BOUTIQUE_LUXE' | 'STREET_BOLD' | 'APPLE_CINEMATIC';

export const TEMA_LABEL: Record<Tema, string> = {
  DEFAULT: 'Organic (original)',
  MONO_EDITORIAL: 'Mono Editorial',
  BOUTIQUE_LUXE: 'Boutique Luxe',
  STREET_BOLD: 'Street Bold',
  APPLE_CINEMATIC: 'Apple Cinematic',
};

// Short slugs used for the `[data-theme]` CSS selectors in globals.css —
// kept distinct from the Prisma enum values so the stylesheet reads cleanly
// (`[data-theme='luxe']` vs `[data-theme='BOUTIQUE_LUXE']`).
export const TEMA_SLUG: Record<Tema, string> = {
  DEFAULT: 'default',
  MONO_EDITORIAL: 'mono',
  BOUTIQUE_LUXE: 'luxe',
  STREET_BOLD: 'bold',
  APPLE_CINEMATIC: 'apple',
};

// The 6 tokens a ThemeVariant can override — deliberately a small subset of
// everything a [data-theme] CSS block defines (see globals.css): the full
// 9-step ramps/typography/radius/shadows stay fixed per tema so editing a
// palette can't accidentally break contrast or component shapes.
export type ColorPalette = {
  bg: string;
  surface: string;
  text: string;
  accent: string;
  accent2: string;
  onAccent: string;
};

// Maps each ColorPalette key to the CSS custom property it overrides —
// shared between the server-rendered root layout (inline style on <html>)
// and the admin "Diseño" tab's live color-picker preview, so both apply a
// variant's colors identically.
export const TEMA_COLOR_VARS: Record<keyof ColorPalette, string> = {
  bg: '--color-bg',
  surface: '--color-surface',
  text: '--color-text',
  accent: '--color-accent',
  accent2: '--color-accent-2',
  onAccent: '--color-on-accent',
};

export type ThemeVariant = {
  id: string;
  tema: Tema;
  nombre: string;
  colores: ColorPalette;
  createdAt: string;
  updatedAt: string;
};

export type BrandingConfig = {
  nombre: string;
  heroTitulo: string;
  heroDescripcion: string;
  logoUrl: string | null;
  featuredCategoryIds: string[];
  heroImageUrl: string | null;
  pagoTarjetaActivo: boolean;
  pagoTransferenciaActivo: boolean;
  colorFondo: string | null;
  temaId: Tema;
  temaVariantId: string | null;
  temaVariant: ThemeVariant | null;
};
export type BankInfo = { alias: string; banco: string; tipoCuenta: string; numero: string; identificacion: string; titular: string };
export type AboutContent = {
  historia: string;
  anioFundacion: string;
  direccion: string;
  googleMapsUrl: string;
  telefono: string;
  emailContacto: string;
  fotoPortadaUrl: string | null;
  fotoLocalUrl: string | null;
};

export type ReportConfig = {
  activo: boolean;
  diaSemana: number;
  hora: string;
  incluirMasVendidos: boolean;
  incluirMenosVendidos: boolean;
  ultimoEnvio: string | null;
};
export type ReportRecipient = { id: string; nombre: string; email: string; recibeReporteStock: boolean };
export const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export type DashboardData = {
  stats: { ingresosConfirmados: number; ordenesTotales: number; stockBajo: number; clientesNuevos: number };
  salesBars: { day: string; pct: number }[];
  topProducts: { id: string; nombre: string; icon: string }[];
  lowStock: { id: string; nombre: string; categoriaNombre: string; stock: number }[];
};

export type ReportColumn = { key: string; label: string; align?: 'left' | 'right' };
export type ReportRow = Record<string, string | number>;
export type ReportResult = {
  title: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  summary?: { label: string; value: string }[];
};
