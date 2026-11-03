type PackAwareProduct = {
  stock: number;
  ventaConjuntoActivo: boolean;
  ventaConjuntoUnidades: number;
  unidadesSueltas: number;
};

// Total sellable units regardless of how they're currently split between
// whole packs and loose units — this is what customers actually buy in, and
// what stock checks should compare against (never the raw `stock` column
// alone, since for pack products that column only counts whole packs).
export function totalUnidadesDisponibles(product: PackAwareProduct) {
  if (!product.ventaConjuntoActivo) return product.stock;
  return product.stock * product.ventaConjuntoUnidades + product.unidadesSueltas;
}

type VentaAwareProduct = PackAwareProduct & { ventaUnidadActiva: boolean };

// How much is available to sell in a given mode — PAQUETE checks the raw
// stock (pack) column directly, UNIDAD checks the pack-aware total and is
// entirely unavailable (0) for a "solo por paquete" product that never
// tracks loose units.
export function disponibleParaVenta(product: VentaAwareProduct, tipoVenta: 'UNIDAD' | 'PAQUETE') {
  if (tipoVenta === 'PAQUETE') {
    return product.ventaConjuntoActivo ? product.stock : 0;
  }
  if (product.ventaConjuntoActivo && !product.ventaUnidadActiva) return 0;
  return totalUnidadesDisponibles(product);
}

// Selling `cantidad` units: drain unidadesSueltas first, breaking open new
// packs only once that runs out. Assumes the caller already verified
// totalUnidadesDisponibles(product) >= cantidad.
export function computeStockDecrement(product: PackAwareProduct, cantidad: number) {
  if (!product.ventaConjuntoActivo) {
    return { stock: product.stock - cantidad, unidadesSueltas: product.unidadesSueltas };
  }
  if (product.unidadesSueltas >= cantidad) {
    return { stock: product.stock, unidadesSueltas: product.unidadesSueltas - cantidad };
  }
  const falta = cantidad - product.unidadesSueltas;
  const paquetesARomper = Math.ceil(falta / product.ventaConjuntoUnidades);
  return {
    stock: product.stock - paquetesARomper,
    unidadesSueltas: product.unidadesSueltas + paquetesARomper * product.ventaConjuntoUnidades - cantidad,
  };
}

// Restocking (order cancelled/refunded, or admin "Reposición" entering loose
// units): add `cantidad` units back to unidadesSueltas directly. stock
// (packs) and unidadesSueltas are independent counters here — this never
// auto-converts a full pack's worth of loose units into `stock`, even if
// unidadesSueltas ends up exceeding ventaConjuntoUnidades. Packs only ever
// change via an explicit "reponer por paquetes" (computeStockIncrementPaquetes)
// or by being broken open during a unit sale (computeStockDecrement).
export function computeStockIncrementUnidades(product: PackAwareProduct, cantidad: number) {
  if (!product.ventaConjuntoActivo) {
    return { stock: product.stock + cantidad, unidadesSueltas: product.unidadesSueltas };
  }
  return { stock: product.stock, unidadesSueltas: product.unidadesSueltas + cantidad };
}

// Reposición entered directly in whole packs.
export function computeStockIncrementPaquetes(product: PackAwareProduct, paquetes: number) {
  return { stock: product.stock + paquetes, unidadesSueltas: product.unidadesSueltas };
}

// Selling `paquetes` whole packs (a distinct sale mode from selling loose
// units) — takes sealed packs directly and never touches unidadesSueltas,
// unlike computeStockDecrement. Assumes the caller already verified
// product.stock >= paquetes.
export function computeStockDecrementPaquetes(product: PackAwareProduct, paquetes: number) {
  return { stock: product.stock - paquetes, unidadesSueltas: product.unidadesSueltas };
}
