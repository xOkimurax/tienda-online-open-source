// Icon path data ported verbatim from the design handoff
// (project/Panel Admin.dc.html — ICON_PATHS / NAV) so nav and product
// glyphs match the approved mockups exactly.

export const NAV_ICONS: Record<string, string> = {
  dashboard: '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
  productos:
    '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23Z"/>',
  pedidos:
    '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  categorias:
    '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  proveedores:
    '<rect x="1" y="7" width="15" height="13" rx="1.5"/><path d="M16 11h3l3 3v6h-6"/><circle cx="6" cy="20" r="1.8"/><circle cx="17.5" cy="20" r="1.8"/>',
  cupones:
    '<path d="M2 9a3 3 0 1 0 0 6"/><path d="M9 3v2m0 4v2m0 4v2m0 4v2"/><rect x="6" y="5" width="16" height="14" rx="2"/>',
  usuarios:
    '<path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  reportes: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  config:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
};

export const PRODUCT_ICONS: Record<string, string> = {
  camisa:
    '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23Z"/>',
  zapato:
    '<path d="M2 18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-1.5c0-.5-.3-1-.8-1.2l-4-1.6-3.2-4a2 2 0 0 0-1.6-.8H8a2 2 0 0 0-2 2v2.4l-3.2 1.3a2 2 0 0 0-1.2 1.8Z"/><path d="M6 10V8"/>',
  bolso: '<path d="M6 10V7a4 4 0 0 1 8 0v3"/><path d="M4 10h12l1 10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  gorra: '<path d="M3 15a9 9 0 0 1 18 0"/><path d="M3 15h18"/><path d="M12 6v9"/>',
  reloj: '<path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="10"/>',
  lentes:
    '<circle cx="6" cy="12" r="3"/><circle cx="18" cy="12" r="3"/><path d="M9 12h6"/><path d="M3 12l1.5-4h1"/><path d="M21 12l-1.5-4h-1"/>',
};

export const EDIT_ICON = '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>';
export const DELETE_ICON =
  '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>';
export const CLOSE_ICON = '<path d="M18 6 6 18"/><path d="M6 6l12 12"/>';
export const DOC_ICON = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/>';
export const STAR_ICON =
  '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>';
export const WARNING_ICON =
  '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>';
