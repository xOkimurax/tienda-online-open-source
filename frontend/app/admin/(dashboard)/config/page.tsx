'use client';

import { useEffect, useState } from 'react';
import { adminFetch, adminJson } from '@/lib/adminApi';
import { useToast } from '@/lib/ToastContext';
import { Icon } from '@/components/Icon';
import { CLOSE_ICON } from '@/lib/icons';
import {
  AboutContent,
  BankInfo,
  BrandingConfig,
  ColorPalette,
  DIAS_SEMANA,
  ReportConfig,
  ReportRecipient,
  Tema,
  TEMA_COLOR_VARS,
  TEMA_LABEL,
  TEMA_SLUG,
  ThemeVariant,
} from '@/lib/types';

type StagedFile = { file: File; previewUrl: string };
type Tab = 'marca' | 'diseno' | 'bancarios' | 'pagos' | 'quienes' | 'reporte';

// Matches --color-bg in globals.css — shown as the reference/placeholder
// when no custom color is set, and what "Restablecer" reverts to.
const DEFAULT_COLOR_FONDO = '#f5ead8';

// Static preview data for the "Diseño" tab's cards — swatches/fonts mirror
// each [data-theme] block in globals.css, just re-stated here since this
// page can't easily render a live iframe preview per theme.
const TEMAS_PREVIEW: { id: Tema; label: string; description: string; bg: string; swatches: string[]; fontFamily: string }[] = [
  {
    id: 'DEFAULT',
    label: TEMA_LABEL.DEFAULT,
    description: 'El diseño actual de la tienda — cálido, artesanal, tipografía Caprasimo.',
    bg: '#f5ead8',
    swatches: ['#c67139', '#7a8a5e', '#2e2b25'],
    fontFamily: '"Caprasimo", serif',
  },
  {
    id: 'MONO_EDITORIAL',
    label: TEMA_LABEL.MONO_EDITORIAL,
    description: 'Blanco y negro puro, una sola tipografía, esquinas rectas. Minimalismo editorial.',
    bg: '#ffffff',
    swatches: ['#111111', '#52606d', '#dcdcdc'],
    fontFamily: '"Space Grotesk", sans-serif',
  },
  {
    id: 'BOUTIQUE_LUXE',
    label: TEMA_LABEL.BOUTIQUE_LUXE,
    description: 'Verde botella y dorado sobre fondo oscuro, serif elegante. Marca premium.',
    bg: '#141110',
    swatches: ['#2f6b4f', '#c9a24b', '#f3ead9'],
    fontFamily: '"Cormorant Garamond", serif',
  },
  {
    id: 'STREET_BOLD',
    label: TEMA_LABEL.STREET_BOLD,
    description: 'Magenta y lima eléctricos, tipografía pesada, sombras duras. Energía streetwear.',
    bg: '#f7f7f2',
    swatches: ['#ff2d78', '#caff00', '#0a0a0a'],
    fontFamily: '"Archivo Black", sans-serif',
  },
  {
    id: 'APPLE_CINEMATIC',
    label: TEMA_LABEL.APPLE_CINEMATIC,
    description: 'Blanco, azul y tipografía grande con animaciones al hacer scroll. Estilo apple.com.',
    bg: '#ffffff',
    swatches: ['#0071e3', '#1d1d1f', '#f5f5f7'],
    fontFamily: '"Inter", sans-serif',
  },
];

// The built-in 6-token palette of each tema, exactly matching its
// [data-theme] block's :root-level values in globals.css — seeds the color
// editor when an admin starts a brand-new variant "from" a base design
// (editing an existing variant instead seeds from that variant's own
// colores, see openEditor below).
const BASE_PALETTE: Record<Tema, ColorPalette> = {
  DEFAULT: { bg: '#f5ead8', surface: '#ebddc5', text: '#201e1d', accent: '#c67139', accent2: '#7a8a5e', onAccent: '#f5ead8' },
  MONO_EDITORIAL: { bg: '#ffffff', surface: '#f4f4f5', text: '#0a0a0a', accent: '#111111', accent2: '#52606d', onAccent: '#ffffff' },
  BOUTIQUE_LUXE: { bg: '#141110', surface: '#1f1a16', text: '#f3ead9', accent: '#2f6b4f', accent2: '#c9a24b', onAccent: '#f8f4ea' },
  STREET_BOLD: { bg: '#f7f7f2', surface: '#ffffff', text: '#0a0a0a', accent: '#ff2d78', accent2: '#7a8f00', onAccent: '#ffffff' },
  APPLE_CINEMATIC: { bg: '#ffffff', surface: '#f5f5f7', text: '#1d1d1f', accent: '#0071e3', accent2: '#86868b', onAccent: '#ffffff' },
};

const COLOR_FIELDS: { key: keyof ColorPalette; label: string }[] = [
  { key: 'bg', label: 'Fondo' },
  { key: 'surface', label: 'Superficie' },
  { key: 'text', label: 'Texto' },
  { key: 'accent', label: 'Acento' },
  { key: 'accent2', label: 'Acento secundario' },
  { key: 'onAccent', label: 'Texto sobre acento' },
];

// Sets (or, with null, clears) the 6 editable --color-* custom properties
// directly on <html> — same mechanism the server-rendered root layout uses
// for a saved variant, just driven live here as the admin edits/applies one,
// so the whole admin UI (and a "Ver tienda cliente" tab) previews instantly
// without a reload. An inline style always wins over the [data-theme]
// stylesheet rules, so this doesn't need !important or to know which base
// tema is active.
function applyThemeStyleVars(colores: ColorPalette | null) {
  const el = document.documentElement;
  for (const cssVar of Object.values(TEMA_COLOR_VARS)) el.style.removeProperty(cssVar);
  if (!colores) return;
  for (const [key, cssVar] of Object.entries(TEMA_COLOR_VARS)) {
    el.style.setProperty(cssVar, colores[key as keyof ColorPalette]);
  }
}

const TABS: { value: Tab; label: string }[] = [
  { value: 'marca', label: 'Marca' },
  { value: 'diseno', label: 'Diseño' },
  { value: 'bancarios', label: 'Datos bancarios' },
  { value: 'pagos', label: 'Métodos de pago' },
  { value: 'quienes', label: 'Quiénes somos' },
  { value: 'reporte', label: 'Reporte semanal' },
];

export default function ConfigPage() {
  const flash = useToast();
  const [tab, setTab] = useState<Tab>('marca');
  const [branding, setBranding] = useState<BrandingConfig>({
    nombre: '',
    heroTitulo: '',
    heroDescripcion: '',
    logoUrl: null,
    featuredCategoryIds: [],
    heroImageUrl: null,
    pagoTarjetaActivo: true,
    pagoTransferenciaActivo: true,
    colorFondo: null,
    temaId: 'DEFAULT',
    temaVariantId: null,
    temaVariant: null,
  });
  const [savingTema, setSavingTema] = useState(false);
  const [variants, setVariants] = useState<ThemeVariant[]>([]);
  // Which base tema's color editor panel is open (null = closed). A single
  // shared draft is enough since only one panel can be open at a time.
  const [editingTema, setEditingTema] = useState<Tema | null>(null);
  // null while editingTema is open means "new variant from scratch"; set to
  // an existing variant's id means the editor is re-coloring that variant.
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [colorDraft, setColorDraft] = useState<ColorPalette | null>(null);
  const [variantNameDraft, setVariantNameDraft] = useState('');
  const [savingVariant, setSavingVariant] = useState(false);
  const [bank, setBank] = useState<BankInfo>({ alias: '', banco: '', tipoCuenta: '', numero: '', identificacion: '', titular: '' });
  const [about, setAbout] = useState<AboutContent>({
    historia: '',
    anioFundacion: '',
    direccion: '',
    googleMapsUrl: '',
    telefono: '',
    emailContacto: '',
    fotoPortadaUrl: null,
    fotoLocalUrl: null,
  });

  // Images are staged locally (like the product form) — nothing uploads
  // until the section's own "Guardar" button is pressed.
  const [stagedLogo, setStagedLogo] = useState<StagedFile | null>(null);
  const [stagedHero, setStagedHero] = useState<StagedFile | null>(null);
  // Marking the hero image for removal is staged too — it only actually
  // deletes when "Guardar marca" is pressed, so backing out just means
  // never pressing save (or clicking "Deshacer").
  const [heroRemoved, setHeroRemoved] = useState(false);
  const [stagedPortada, setStagedPortada] = useState<StagedFile | null>(null);
  const [stagedLocal, setStagedLocal] = useState<StagedFile | null>(null);
  const [savingBranding, setSavingBranding] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [savingPagos, setSavingPagos] = useState(false);
  const [savingAbout, setSavingAbout] = useState(false);

  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    activo: false,
    diaSemana: 1,
    hora: '08:00',
    incluirMasVendidos: false,
    incluirMenosVendidos: false,
    ultimoEnvio: null,
  });
  const [reportRecipients, setReportRecipients] = useState<ReportRecipient[]>([]);
  const [savingReport, setSavingReport] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  function reload() {
    adminJson<{ branding: BrandingConfig; bankInfo: BankInfo; about: AboutContent }>('/api/admin/config', 'GET').then(
      (data) => {
        setBranding(data.branding);
        setBank(data.bankInfo);
        setAbout(data.about);
        // Re-syncs the live preview too (not just state) — matters when
        // this runs after deleting the variant currently in use, where the
        // server just fell back to the plain tema but the admin's own
        // <html> inline style vars would otherwise still show the deleted
        // variant's colors until a hard reload.
        document.documentElement.setAttribute('data-theme', TEMA_SLUG[data.branding.temaId]);
        applyThemeStyleVars(data.branding.temaVariant?.colores ?? null);
      },
    );
  }
  useEffect(reload, []);

  function reloadVariants() {
    adminJson<ThemeVariant[]>('/api/admin/config/theme-variants', 'GET').then(setVariants);
  }
  useEffect(reloadVariants, []);

  // While the color editor is open, preview the draft live across the whole
  // admin UI (same mechanism applyVariant/saveTema use) — closing it reverts
  // to whatever's actually saved on `branding`.
  useEffect(() => {
    if (!editingTema || !colorDraft) return;
    document.documentElement.setAttribute('data-theme', TEMA_SLUG[editingTema]);
    applyThemeStyleVars(colorDraft);
  }, [editingTema, colorDraft]);

  function revertThemePreview() {
    document.documentElement.setAttribute('data-theme', TEMA_SLUG[branding.temaId]);
    applyThemeStyleVars(branding.temaVariant?.colores ?? null);
  }

  function openEditor(tema: Tema, variant?: ThemeVariant) {
    setEditingTema(tema);
    setEditingVariantId(variant?.id ?? null);
    setColorDraft(variant ? variant.colores : BASE_PALETTE[tema]);
    setVariantNameDraft(variant?.nombre ?? '');
  }

  function closeEditor() {
    setEditingTema(null);
    setEditingVariantId(null);
    setColorDraft(null);
    revertThemePreview();
  }

  async function saveVariant() {
    if (!editingTema || !colorDraft || savingVariant) return;
    if (!variantNameDraft.trim()) {
      flash('Ponele un nombre a la variante', 'error');
      return;
    }
    setSavingVariant(true);
    try {
      if (editingVariantId) {
        const saved = await adminJson<ThemeVariant>(`/api/admin/config/theme-variants/${editingVariantId}`, 'PUT', {
          nombre: variantNameDraft,
          colores: colorDraft,
        });
        setVariants((vs) => vs.map((v) => (v.id === saved.id ? saved : v)));
      } else {
        const saved = await adminJson<ThemeVariant>('/api/admin/config/theme-variants', 'POST', {
          tema: editingTema,
          nombre: variantNameDraft,
          colores: colorDraft,
        });
        setVariants((vs) => [...vs, saved]);
      }
      flash('Variante guardada');
      closeEditor();
    } finally {
      setSavingVariant(false);
    }
  }

  async function applyVariant(variant: ThemeVariant) {
    if (savingTema) return;
    setSavingTema(true);
    try {
      const updated = await adminJson<BrandingConfig>('/api/admin/config/branding', 'PUT', {
        nombre: branding.nombre,
        heroTitulo: branding.heroTitulo,
        heroDescripcion: branding.heroDescripcion,
        pagoTarjetaActivo: branding.pagoTarjetaActivo,
        pagoTransferenciaActivo: branding.pagoTransferenciaActivo,
        colorFondo: branding.colorFondo,
        temaId: variant.tema,
        temaVariantId: variant.id,
      });
      setBranding(updated);
      document.documentElement.setAttribute('data-theme', TEMA_SLUG[variant.tema]);
      applyThemeStyleVars(variant.colores);
      flash(`Diseño actualizado: ${variant.nombre}`);
    } finally {
      setSavingTema(false);
    }
  }

  async function deleteVariant(variant: ThemeVariant) {
    if (!confirm(`¿Eliminar la variante "${variant.nombre}"? Esta acción no se puede deshacer.`)) return;
    await adminFetch(`/api/admin/config/theme-variants/${variant.id}`, { method: 'DELETE' });
    setVariants((vs) => vs.filter((v) => v.id !== variant.id));
    // If it was the active one, the backend already cleared
    // branding.temaVariantId (onDelete: SetNull) — reload to reflect that
    // here instead of guessing the fallback state ourselves.
    if (branding.temaVariantId === variant.id) reload();
    flash('Variante eliminada');
  }

  function reloadReport() {
    adminJson<{ config: ReportConfig; admins: ReportRecipient[] }>('/api/admin/config/report', 'GET').then((data) => {
      setReportConfig(data.config);
      setReportRecipients(data.admins);
    });
  }
  useEffect(reloadReport, []);

  // Revoke any staged object URLs left over if the admin navigates away
  // before pressing the relevant "Guardar" button.
  useEffect(() => {
    return () => {
      if (stagedLogo) URL.revokeObjectURL(stagedLogo.previewUrl);
      if (stagedHero) URL.revokeObjectURL(stagedHero.previewUrl);
      if (stagedPortada) URL.revokeObjectURL(stagedPortada.previewUrl);
      if (stagedLocal) URL.revokeObjectURL(stagedLocal.previewUrl);
    };
  }, [stagedLogo, stagedHero, stagedPortada, stagedLocal]);

  function stage(file: File, setter: (s: StagedFile) => void) {
    setter({ file, previewUrl: URL.createObjectURL(file) });
  }
  function unstage(staged: StagedFile | null, setter: (s: null) => void) {
    if (staged) URL.revokeObjectURL(staged.previewUrl);
    setter(null);
  }

  // Uploading a new hero image cancels any pending "quitar" — the new file
  // wins.
  function stageHero(file: File) {
    setHeroRemoved(false);
    stage(file, setStagedHero);
  }

  // "Marca" and "Métodos de pago" are separate tabs/buttons but both PUT the
  // same BrandingConfig record — each just sends the fields relevant to it
  // alongside whatever's currently in state for the other, so they never
  // stomp on each other.
  async function saveBranding() {
    if (savingBranding) return;
    setSavingBranding(true);
    try {
      let updated = await adminJson<BrandingConfig>('/api/admin/config/branding', 'PUT', {
        nombre: branding.nombre,
        heroTitulo: branding.heroTitulo,
        heroDescripcion: branding.heroDescripcion,
        pagoTarjetaActivo: branding.pagoTarjetaActivo,
        pagoTransferenciaActivo: branding.pagoTransferenciaActivo,
        colorFondo: branding.colorFondo,
        temaId: branding.temaId,
        temaVariantId: branding.temaVariantId,
      });
      if (stagedLogo) {
        const form = new FormData();
        form.append('logo', stagedLogo.file);
        updated = await adminFetch<BrandingConfig>('/api/admin/config/branding/logo', { method: 'POST', body: form });
        unstage(stagedLogo, setStagedLogo);
      }
      // Nothing was actually deleted or uploaded until this button was
      // pressed — heroRemoved/stagedHero were purely local state up to now.
      if (stagedHero) {
        const form = new FormData();
        form.append('hero', stagedHero.file);
        updated = await adminFetch<BrandingConfig>('/api/admin/config/branding/hero', { method: 'POST', body: form });
        unstage(stagedHero, setStagedHero);
      } else if (heroRemoved) {
        updated = await adminFetch<BrandingConfig>('/api/admin/config/branding/hero', { method: 'DELETE' });
        setHeroRemoved(false);
      }
      setBranding(updated);
      flash('Marca actualizada en toda la tienda');
    } finally {
      setSavingBranding(false);
    }
  }

  async function saveTema(temaId: Tema) {
    if (savingTema) return;
    setSavingTema(true);
    try {
      const updated = await adminJson<BrandingConfig>('/api/admin/config/branding', 'PUT', {
        nombre: branding.nombre,
        heroTitulo: branding.heroTitulo,
        heroDescripcion: branding.heroDescripcion,
        pagoTarjetaActivo: branding.pagoTarjetaActivo,
        pagoTransferenciaActivo: branding.pagoTransferenciaActivo,
        colorFondo: branding.colorFondo,
        temaId,
        // Picking a plain base card always clears any custom variant —
        // applyVariant (below) is the only path that sets one.
        temaVariantId: null,
      });
      setBranding(updated);
      // <html data-theme> was set server-side in the root layout on the
      // request that rendered this page — a plain state update here
      // wouldn't touch it, leaving the admin staring at the OLD theme on
      // their own screen until the next navigation/reload. Flip it
      // directly so the pick feels instant without needing either.
      document.documentElement.setAttribute('data-theme', TEMA_SLUG[temaId]);
      applyThemeStyleVars(null);
      flash(`Diseño actualizado: ${TEMA_LABEL[temaId]}`);
    } finally {
      setSavingTema(false);
    }
  }

  function togglePaymentMethod(method: 'pagoTarjetaActivo' | 'pagoTransferenciaActivo') {
    setBranding((b) => {
      const next = { ...b, [method]: !b[method] };
      if (!next.pagoTarjetaActivo && !next.pagoTransferenciaActivo) {
        flash('Tiene que quedar activo al menos un método de pago', 'error');
        return b;
      }
      return next;
    });
  }

  async function savePaymentMethods() {
    if (savingPagos) return;
    setSavingPagos(true);
    try {
      const updated = await adminJson<BrandingConfig>('/api/admin/config/branding', 'PUT', {
        nombre: branding.nombre,
        heroTitulo: branding.heroTitulo,
        heroDescripcion: branding.heroDescripcion,
        pagoTarjetaActivo: branding.pagoTarjetaActivo,
        pagoTransferenciaActivo: branding.pagoTransferenciaActivo,
        colorFondo: branding.colorFondo,
        temaId: branding.temaId,
        temaVariantId: branding.temaVariantId,
      });
      setBranding(updated);
      flash('Métodos de pago actualizados');
    } finally {
      setSavingPagos(false);
    }
  }

  async function saveBank() {
    if (savingBank) return;
    setSavingBank(true);
    try {
      await adminJson('/api/admin/config/bank-info', 'PUT', bank);
      flash('Datos bancarios guardados');
    } finally {
      setSavingBank(false);
    }
  }

  async function saveAbout() {
    if (savingAbout) return;
    setSavingAbout(true);
    try {
      const { fotoPortadaUrl, fotoLocalUrl, ...rest } = about;
      let updated = await adminJson<AboutContent>('/api/admin/config/about', 'PUT', rest);
      if (stagedPortada) {
        const form = new FormData();
        form.append('foto', stagedPortada.file);
        updated = await adminFetch<AboutContent>('/api/admin/config/about/foto-portada', { method: 'POST', body: form });
        unstage(stagedPortada, setStagedPortada);
      }
      if (stagedLocal) {
        const form = new FormData();
        form.append('foto', stagedLocal.file);
        updated = await adminFetch<AboutContent>('/api/admin/config/about/foto-local', { method: 'POST', body: form });
        unstage(stagedLocal, setStagedLocal);
      }
      setAbout(updated);
      flash('"Quiénes somos" actualizado');
    } finally {
      setSavingAbout(false);
    }
  }

  async function saveReport() {
    if (savingReport) return;
    setSavingReport(true);
    try {
      const recipientIds = reportRecipients.filter((a) => a.recibeReporteStock).map((a) => a.id);
      const data = await adminJson<{ config: ReportConfig; admins: ReportRecipient[] }>('/api/admin/config/report', 'PUT', {
        activo: reportConfig.activo,
        diaSemana: reportConfig.diaSemana,
        hora: reportConfig.hora,
        incluirMasVendidos: reportConfig.incluirMasVendidos,
        incluirMenosVendidos: reportConfig.incluirMenosVendidos,
        recipientIds,
      });
      setReportConfig(data.config);
      setReportRecipients(data.admins);
      flash('Reporte semanal guardado');
    } finally {
      setSavingReport(false);
    }
  }

  async function sendTestReport() {
    if (sendingTest) return;
    setSendingTest(true);
    try {
      await adminJson('/api/admin/config/report/send-test', 'POST');
      flash('Reporte de prueba enviado');
    } finally {
      setSendingTest(false);
    }
  }

  const brandInitial = (branding.nombre || 'T').charAt(0).toUpperCase();

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, margin: '0 0 4px' }}>Configuración</h1>
      <p style={{ margin: '0 0 var(--space-4)', opacity: 0.6, fontSize: 14 }}>
        Marca, pagos y contenido de la tienda — fuente única de verdad, sin redeploy
      </p>

      <div style={{ overflowX: 'auto', marginBottom: 'var(--space-6)' }}>
        <div className="seg" role="tablist" style={{ width: 'max-content' }}>
          {TABS.map((t) => (
            <label key={t.value} className="seg-opt">
              <input type="radio" name="configtab" checked={tab === t.value} onChange={() => setTab(t.value)} />
              {t.label}
            </label>
          ))}
        </div>
      </div>

      {tab === 'marca' && (
        <div className="card elev-sm">
          <div className="card-title">Marca de la tienda</div>
          <p className="card-body" style={{ marginBottom: 'var(--space-3)' }}>
            Se refleja automáticamente en el header, footer, favicon y emails de ambos ambientes.
          </p>
          <div className="field">
            <label>Nombre de la tienda<span className="field-required">*</span></label>
            <input className="input" value={branding.nombre} onChange={(e) => setBranding({ ...branding, nombre: e.target.value })} />
          </div>
          <div className="field">
            <label>Frase del banner de inicio<span className="field-required">*</span></label>
            <p style={{ fontSize: 12, opacity: 0.6, margin: '0 0 8px' }}>
              Se combina con el nombre de la tienda: &quot;{branding.heroTitulo || '…'} {branding.nombre || '…'}&quot;.
            </p>
            <input className="input" value={branding.heroTitulo} onChange={(e) => setBranding({ ...branding, heroTitulo: e.target.value })} />
          </div>
          <div className="field">
            <label>Descripción del banner de inicio<span className="field-required">*</span></label>
            <textarea
              className="input"
              rows={3}
              value={branding.heroDescripcion}
              onChange={(e) => setBranding({ ...branding, heroDescripcion: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Logo<span className="field-optional">(opcional)</span></label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  position: 'relative',
                  width: 56,
                  height: 56,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-accent-100)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flex: 'none',
                }}
              >
                {stagedLogo ? (
                  <div style={{ width: '100%', height: '100%', backgroundImage: `url(${stagedLogo.previewUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                ) : branding.logoUrl ? (
                  <div style={{ width: '100%', height: '100%', backgroundImage: `url(${branding.logoUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                ) : (
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: 22, color: 'var(--color-accent-700)' }}>{brandInitial}</span>
                )}
                {stagedLogo && (
                  <button
                    type="button"
                    aria-label="Quitar logo"
                    onClick={() => unstage(stagedLogo, setStagedLogo)}
                    style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(32,30,29,.65)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icon path={CLOSE_ICON} size={9} stroke="#fff" strokeWidth={3} />
                  </button>
                )}
              </div>
              <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                {stagedLogo ? 'Cambiar logo' : 'Subir logo'}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files?.[0] && stage(e.target.files[0], setStagedLogo)}
                />
              </label>
            </div>
            {stagedLogo && <p style={{ fontSize: 11, opacity: 0.55, margin: '6px 0 0' }}>Se sube al presionar &quot;Guardar marca&quot;.</p>}
          </div>
          <div className="field">
            <label>Fondo de portada del inicio<span className="field-optional">(opcional)</span></label>
            <p style={{ fontSize: 12, opacity: 0.6, margin: '0 0 8px' }}>
              Reemplaza el degradado por defecto del banner principal de la tienda.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                className="washed"
                style={{
                  position: 'relative',
                  width: 120,
                  height: 68,
                  borderRadius: 'var(--radius-md)',
                  background: !stagedHero && (heroRemoved || !branding.heroImageUrl) ? 'linear-gradient(135deg, var(--color-accent-300), var(--color-accent-2-300))' : 'var(--color-accent-100)',
                  overflow: 'hidden',
                  flex: 'none',
                }}
              >
                {stagedHero ? (
                  <div style={{ width: '100%', height: '100%', backgroundImage: `url(${stagedHero.previewUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                ) : !heroRemoved && branding.heroImageUrl ? (
                  <div style={{ width: '100%', height: '100%', backgroundImage: `url(${branding.heroImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                ) : null}
                {stagedHero && (
                  <button
                    type="button"
                    aria-label="Quitar imagen"
                    onClick={() => unstage(stagedHero, setStagedHero)}
                    style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(32,30,29,.65)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icon path={CLOSE_ICON} size={9} stroke="#fff" strokeWidth={3} />
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                  {stagedHero || (branding.heroImageUrl && !heroRemoved) ? 'Cambiar imagen' : 'Subir imagen'}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => e.target.files?.[0] && stageHero(e.target.files[0])}
                  />
                </label>
                {!stagedHero && branding.heroImageUrl && !heroRemoved && (
                  <button type="button" className="btn btn-ghost" onClick={() => setHeroRemoved(true)} style={{ padding: '4px 0' }}>
                    Quitar y usar degradado
                  </button>
                )}
                {!stagedHero && heroRemoved && (
                  <button type="button" className="btn btn-ghost" onClick={() => setHeroRemoved(false)} style={{ padding: '4px 0' }}>
                    Deshacer
                  </button>
                )}
              </div>
            </div>
            {stagedHero && <p style={{ fontSize: 11, opacity: 0.55, margin: '6px 0 0' }}>Se sube al presionar &quot;Guardar marca&quot;.</p>}
            {!stagedHero && heroRemoved && <p style={{ fontSize: 11, opacity: 0.55, margin: '6px 0 0' }}>Se quitará al presionar &quot;Guardar marca&quot;.</p>}
          </div>
          <div className="field">
            <label>Color de fondo de la tienda<span className="field-optional">(opcional)</span></label>
            <p style={{ fontSize: 12, opacity: 0.6, margin: '0 0 8px' }}>
              Reemplaza el color de fondo por defecto en toda la tienda, no solo el inicio.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="color"
                value={branding.colorFondo ?? DEFAULT_COLOR_FONDO}
                onChange={(e) => setBranding({ ...branding, colorFondo: e.target.value })}
                style={{ width: 48, height: 48, padding: 2, border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: 'none' }}
              />
              <input
                className="input"
                value={branding.colorFondo ?? ''}
                placeholder={DEFAULT_COLOR_FONDO}
                onChange={(e) => setBranding({ ...branding, colorFondo: e.target.value || null })}
                style={{ maxWidth: 140 }}
              />
              {branding.colorFondo && (
                <button type="button" className="btn btn-ghost" onClick={() => setBranding({ ...branding, colorFondo: null })}>
                  Restablecer al color por defecto
                </button>
              )}
            </div>
          </div>
          <button type="button" className="btn btn-primary" disabled={savingBranding} onClick={saveBranding}>
            {savingBranding ? 'Guardando…' : 'Guardar marca'}
          </button>
        </div>
      )}

      {tab === 'diseno' && (
        <div className="card elev-sm">
          <div className="card-title">Diseño de la tienda</div>
          <p className="card-body" style={{ marginBottom: 'var(--space-4)' }}>
            Cambia los colores, tipografía y forma de toda la tienda y del panel admin de una sola vez — ninguna página ni botón cambia de lugar, solo el estilo visual. Se aplica apenas lo elegís acá (sin tocar "Guardar marca").
          </p>
          <div className="grid-cards">
            {TEMAS_PREVIEW.map((t) => {
              // "Active" for the plain base card means this tema with NO
              // custom variant on top — a variant's own row below has its
              // own active/"En uso" state.
              const active = branding.temaId === t.id && !branding.temaVariantId;
              const temaVariants = variants.filter((v) => v.tema === t.id);
              const isEditingThis = editingTema === t.id;
              return (
                <div
                  key={t.id}
                  className="card"
                  style={{
                    gap: 'var(--space-3)',
                    border: active ? '2px solid var(--color-accent)' : '1px solid var(--color-divider)',
                  }}
                >
                  <div
                    style={{
                      height: 64,
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      display: 'flex',
                      background: t.bg,
                    }}
                  >
                    {t.swatches.map((c, i) => (
                      <div key={i} style={{ flex: 1, background: c }} />
                    ))}
                  </div>
                  <div>
                    <div style={{ fontFamily: t.fontFamily, fontSize: 17, marginBottom: 2 }}>{t.label}</div>
                    <div className="card-body" style={{ margin: 0 }}>{t.description}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className={active ? 'btn btn-secondary' : 'btn btn-primary'}
                      style={{ flex: 1 }}
                      disabled={savingTema || active}
                      onClick={() => saveTema(t.id)}
                    >
                      {active ? 'En uso' : savingTema ? 'Aplicando…' : 'Usar este diseño'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => (isEditingThis ? closeEditor() : openEditor(t.id))}
                    >
                      {isEditingThis && !editingVariantId ? 'Cancelar' : 'Personalizar colores'}
                    </button>
                  </div>

                  {temaVariants.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', opacity: 0.55 }}>
                        Variantes de colores guardadas
                      </div>
                      {temaVariants.map((v) => {
                        const variantActive = branding.temaVariantId === v.id;
                        return (
                          <div
                            key={v.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '8px 10px',
                              borderRadius: 'var(--radius-md)',
                              background: 'var(--color-surface)',
                              border: variantActive ? '1px solid var(--color-accent)' : '1px solid transparent',
                            }}
                          >
                            <div style={{ display: 'flex', width: 36, height: 20, borderRadius: 4, overflow: 'hidden', flex: 'none' }}>
                              {[v.colores.accent, v.colores.accent2, v.colores.bg].map((c, i) => (
                                <div key={i} style={{ flex: 1, background: c }} />
                              ))}
                            </div>
                            <div style={{ flex: 1, fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {v.nombre}
                            </div>
                            <button type="button" className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => openEditor(t.id, v)}>
                              Editar
                            </button>
                            <button
                              type="button"
                              className={variantActive ? 'btn btn-secondary' : 'btn btn-primary'}
                              style={{ padding: '4px 10px', fontSize: 12 }}
                              disabled={savingTema || variantActive}
                              onClick={() => applyVariant(v)}
                            >
                              {variantActive ? 'En uso' : 'Usar'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              style={{ padding: '4px 8px', fontSize: 12 }}
                              aria-label={`Eliminar variante ${v.nombre}`}
                              onClick={() => deleteVariant(v)}
                            >
                              <Icon path={CLOSE_ICON} size={13} strokeWidth={2.5} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {isEditingThis && colorDraft && (
                    <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div className="field">
                        <label>Nombre de la variante</label>
                        <input
                          className="input"
                          value={variantNameDraft}
                          onChange={(e) => setVariantNameDraft(e.target.value)}
                          placeholder="Ej: Verano, Edición rosa…"
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                        {COLOR_FIELDS.map((f) => (
                          <div key={f.key} className="field">
                            <label>{f.label}</label>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <input
                                type="color"
                                value={colorDraft[f.key]}
                                onChange={(e) => setColorDraft((c) => (c ? { ...c, [f.key]: e.target.value } : c))}
                                style={{ width: 36, height: 36, padding: 0, border: 'none', borderRadius: 6, cursor: 'pointer', flex: 'none' }}
                              />
                              <input
                                className="input"
                                value={colorDraft[f.key]}
                                onChange={(e) => setColorDraft((c) => (c ? { ...c, [f.key]: e.target.value } : c))}
                                style={{ flex: 1 }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="btn btn-primary" disabled={savingVariant} onClick={saveVariant}>
                          {savingVariant ? 'Guardando…' : editingVariantId ? 'Guardar cambios' : 'Guardar como variante nueva'}
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={closeEditor}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'bancarios' && (
        <div className="card elev-sm">
          <div className="card-title">Datos bancarios (transferencia)</div>
          <p className="card-body" style={{ marginBottom: 'var(--space-3)' }}>
            Visibles al cliente solo tras confirmarse existencia (si aplica) y al elegir transferencia.
          </p>
          <div className="field">
            <label>Alias<span className="field-optional">(opcional)</span></label>
            <input className="input" value={bank.alias} onChange={(e) => setBank({ ...bank, alias: e.target.value })} />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Banco<span className="field-optional">(opcional)</span></label>
              <input className="input" value={bank.banco} onChange={(e) => setBank({ ...bank, banco: e.target.value })} />
            </div>
            <div className="field">
              <label>Tipo de cuenta<span className="field-optional">(opcional)</span></label>
              <input className="input" value={bank.tipoCuenta} onChange={(e) => setBank({ ...bank, tipoCuenta: e.target.value })} />
            </div>
            <div className="field">
              <label>Número de cuenta<span className="field-optional">(opcional)</span></label>
              <input className="input" value={bank.numero} onChange={(e) => setBank({ ...bank, numero: e.target.value })} />
            </div>
            <div className="field">
              <label>Identificación (RUC/CI)<span className="field-optional">(opcional)</span></label>
              <input className="input" value={bank.identificacion} onChange={(e) => setBank({ ...bank, identificacion: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>Titular<span className="field-optional">(opcional)</span></label>
            <input className="input" value={bank.titular} onChange={(e) => setBank({ ...bank, titular: e.target.value })} />
          </div>
          <button type="button" className="btn btn-primary" disabled={savingBank} onClick={saveBank}>
            {savingBank ? 'Guardando…' : 'Guardar datos bancarios'}
          </button>
        </div>
      )}

      {tab === 'pagos' && (
        <div className="card elev-sm">
          <div className="card-title">Métodos de pago</div>
          <p className="card-body" style={{ marginBottom: 'var(--space-3)' }}>
            Los métodos desactivados no aparecen como opción en el checkout. Siempre tiene que quedar al menos uno activo.
          </p>
          <label className="radio" style={{ display: 'flex', marginBottom: 8 }}>
            <input type="checkbox" checked={branding.pagoTarjetaActivo} onChange={() => togglePaymentMethod('pagoTarjetaActivo')} />
            <span className="dot" />
            Tarjeta (Stripe)
          </label>
          <label className="radio" style={{ display: 'flex', marginBottom: 'var(--space-3)' }}>
            <input type="checkbox" checked={branding.pagoTransferenciaActivo} onChange={() => togglePaymentMethod('pagoTransferenciaActivo')} />
            <span className="dot" />
            Transferencia bancaria
          </label>
          <button type="button" className="btn btn-primary" disabled={savingPagos} onClick={savePaymentMethods}>
            {savingPagos ? 'Guardando…' : 'Guardar métodos de pago'}
          </button>
        </div>
      )}

      {tab === 'quienes' && (
        <div className="card elev-sm">
          <div className="card-title">Quiénes somos</div>
          <p className="card-body" style={{ marginBottom: 'var(--space-3)' }}>
            Contenido de la página "Quiénes somos" de la tienda — para generar confianza con tus clientes.
          </p>
          <div className="grid-2">
            <div className="field">
              <label>Año de fundación<span className="field-optional">(opcional)</span></label>
              <input className="input" value={about.anioFundacion} onChange={(e) => setAbout({ ...about, anioFundacion: e.target.value })} />
            </div>
            <div className="field">
              <label>Teléfono<span className="field-optional">(opcional)</span></label>
              <input className="input" value={about.telefono} onChange={(e) => setAbout({ ...about, telefono: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>Nuestra historia<span className="field-optional">(opcional)</span></label>
            <textarea className="input" rows={4} value={about.historia} onChange={(e) => setAbout({ ...about, historia: e.target.value })} />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Dirección del local físico<span className="field-optional">(opcional)</span></label>
              <input className="input" value={about.direccion} onChange={(e) => setAbout({ ...about, direccion: e.target.value })} />
            </div>
            <div className="field">
              <label>Email de contacto<span className="field-optional">(opcional)</span></label>
              <input className="input" value={about.emailContacto} onChange={(e) => setAbout({ ...about, emailContacto: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>Ubicación en Google Maps<span className="field-optional">(opcional)</span></label>
            <input
              className="input"
              placeholder="https://maps.google.com/..."
              value={about.googleMapsUrl}
              onChange={(e) => setAbout({ ...about, googleMapsUrl: e.target.value })}
            />
          </div>
          <div className="grid-2" style={{ marginBottom: 'var(--space-3)' }}>
            <div className="field">
              <label>Foto de portada<span className="field-optional">(opcional)</span></label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ position: 'relative', width: 80, height: 56, borderRadius: 'var(--radius-md)', background: 'var(--color-accent-100)', overflow: 'hidden', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {stagedPortada ? (
                    <div style={{ width: '100%', height: '100%', backgroundImage: `url(${stagedPortada.previewUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  ) : about.fotoPortadaUrl ? (
                    <div style={{ width: '100%', height: '100%', backgroundImage: `url(${about.fotoPortadaUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  ) : (
                    <span style={{ fontSize: 10, opacity: 0.5 }}>Sin foto</span>
                  )}
                  {stagedPortada && (
                    <button
                      type="button"
                      aria-label="Quitar foto de portada"
                      onClick={() => unstage(stagedPortada, setStagedPortada)}
                      style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(32,30,29,.65)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Icon path={CLOSE_ICON} size={9} stroke="#fff" strokeWidth={3} />
                    </button>
                  )}
                </div>
                <label className="btn btn-secondary" style={{ cursor: 'pointer', padding: '8px 12px', fontSize: 12 }}>
                  {stagedPortada ? 'Cambiar' : 'Subir'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && stage(e.target.files[0], setStagedPortada)} />
                </label>
              </div>
            </div>
            <div className="field">
              <label>Foto del local<span className="field-optional">(opcional)</span></label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ position: 'relative', width: 80, height: 56, borderRadius: 'var(--radius-md)', background: 'var(--color-accent-100)', overflow: 'hidden', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {stagedLocal ? (
                    <div style={{ width: '100%', height: '100%', backgroundImage: `url(${stagedLocal.previewUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  ) : about.fotoLocalUrl ? (
                    <div style={{ width: '100%', height: '100%', backgroundImage: `url(${about.fotoLocalUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  ) : (
                    <span style={{ fontSize: 10, opacity: 0.5 }}>Sin foto</span>
                  )}
                  {stagedLocal && (
                    <button
                      type="button"
                      aria-label="Quitar foto del local"
                      onClick={() => unstage(stagedLocal, setStagedLocal)}
                      style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(32,30,29,.65)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Icon path={CLOSE_ICON} size={9} stroke="#fff" strokeWidth={3} />
                    </button>
                  )}
                </div>
                <label className="btn btn-secondary" style={{ cursor: 'pointer', padding: '8px 12px', fontSize: 12 }}>
                  {stagedLocal ? 'Cambiar' : 'Subir'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && stage(e.target.files[0], setStagedLocal)} />
                </label>
              </div>
            </div>
          </div>
          {(stagedPortada || stagedLocal) && (
            <p style={{ fontSize: 11, opacity: 0.55, margin: '0 0 var(--space-3)' }}>Las fotos se suben al presionar &quot;Guardar &apos;Quiénes somos&apos;&quot;.</p>
          )}
          <button type="button" className="btn btn-primary" disabled={savingAbout} onClick={saveAbout}>
            {savingAbout ? 'Guardando…' : 'Guardar "Quiénes somos"'}
          </button>
        </div>
      )}

      {tab === 'reporte' && (
        <div className="card elev-sm">
          <div className="card-title">Reporte semanal de stock</div>
          <p className="card-body" style={{ marginBottom: 'var(--space-3)' }}>
            Un correo automático con los productos en stock bajo (según el "Stock mínimo" de cada producto) y, opcionalmente,
            los más y menos vendidos de la semana.
          </p>
          <label className="radio" style={{ marginBottom: 'var(--space-3)' }}>
            <input type="checkbox" checked={reportConfig.activo} onChange={(e) => setReportConfig({ ...reportConfig, activo: e.target.checked })} />
            <span className="dot" />
            Activar reporte semanal
          </label>
          <div className="grid-2">
            <div className="field">
              <label>Día de envío</label>
              <select
                className="input"
                value={reportConfig.diaSemana}
                onChange={(e) => setReportConfig({ ...reportConfig, diaSemana: Number(e.target.value) })}
              >
                {DIAS_SEMANA.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Hora de envío</label>
              <input
                type="time"
                className="input"
                value={reportConfig.hora}
                onChange={(e) => setReportConfig({ ...reportConfig, hora: e.target.value })}
              />
            </div>
          </div>
          <label className="radio" style={{ marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={reportConfig.incluirMasVendidos}
              onChange={(e) => setReportConfig({ ...reportConfig, incluirMasVendidos: e.target.checked })}
            />
            <span className="dot" />
            Incluir productos más vendidos de la semana
          </label>
          <label className="radio" style={{ marginBottom: 'var(--space-3)' }}>
            <input
              type="checkbox"
              checked={reportConfig.incluirMenosVendidos}
              onChange={(e) => setReportConfig({ ...reportConfig, incluirMenosVendidos: e.target.checked })}
            />
            <span className="dot" />
            Incluir productos menos vendidos de la semana
          </label>

          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label style={{ fontSize: 12, letterSpacing: '.04em', textTransform: 'uppercase', opacity: 0.6, display: 'block', marginBottom: 8 }}>
              Administradores que reciben el reporte
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {reportRecipients.map((admin) => (
                <label key={admin.id} className="radio">
                  <input
                    type="checkbox"
                    checked={admin.recibeReporteStock}
                    onChange={(e) =>
                      setReportRecipients((list) => list.map((a) => (a.id === admin.id ? { ...a, recibeReporteStock: e.target.checked } : a)))
                    }
                  />
                  <span className="dot" />
                  {admin.nombre} <span style={{ opacity: 0.55, marginLeft: 6 }}>{admin.email}</span>
                </label>
              ))}
              {reportRecipients.length === 0 && <p style={{ opacity: 0.6, fontSize: 13, margin: 0 }}>No hay administradores activos.</p>}
            </div>
          </div>

          {reportConfig.ultimoEnvio && (
            <p style={{ fontSize: 11.5, opacity: 0.55, marginBottom: 'var(--space-3)' }}>
              Último envío: {new Date(reportConfig.ultimoEnvio).toLocaleString('es-PY')}
            </p>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-primary" disabled={savingReport} onClick={saveReport}>
              {savingReport ? 'Guardando…' : 'Guardar reporte semanal'}
            </button>
            <button type="button" className="btn btn-secondary" disabled={sendingTest} onClick={sendTestReport}>
              {sendingTest ? 'Enviando…' : 'Enviar de prueba ahora'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
