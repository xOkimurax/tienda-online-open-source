export function formatGs(value: number) {
  return new Intl.NumberFormat('es-PY').format(Math.round(value || 0));
}

export function parseGsInput(str: string) {
  const digits = str.replace(/[^0-9]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

// For "Gs." price inputs: strips anything that isn't a digit as you type,
// and re-formats with the thousands separator live (so "50000" becomes
// "50.000" on every keystroke, not just on save).
export function sanitizeGsInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  return digits ? formatGs(parseInt(digits, 10)) : '';
}

// For plain numeric inputs that shouldn't get a thousands separator (e.g. a
// percentage, or a quantity) but still must reject non-digit characters.
export function sanitizeDigitsInput(raw: string): string {
  return raw.replace(/[^0-9]/g, '');
}

export function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-PY', { day: '2-digit', month: 'short' });
}

export function formatFechaLarga(iso: string) {
  return new Date(iso).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' });
}
