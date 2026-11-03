import { Router } from 'express';
import { z } from 'zod';
import { Tema } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { asyncHandler, HttpError } from '@/lib/asyncHandler';
import { requireRole } from '@/middleware/adminAuth';
import { uploadImage, publicUrlFor } from '@/lib/upload';
import { resolveFeaturedCategoryIds } from '@/lib/featuredCategories';

export const adminConfigRouter = Router();
const CONFIG_ROLES = ['SUPER_ADMIN', 'ADMIN'] as const;

// Every endpoint below that returns a BrandingConfig includes temaVariant
// (the full saved-palette row, not just its id) so the admin UI and the
// public /store/content/branding fetch both always get the actual color
// overrides to apply — not just a dangling foreign key.
const INCLUDE_TEMA_VARIANT = { include: { temaVariant: true } } as const;

adminConfigRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [branding, bankInfo, about] = await Promise.all([
      prisma.brandingConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 }, ...INCLUDE_TEMA_VARIANT }),
      prisma.bankInfo.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
      prisma.aboutContent.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
    ]);
    res.json({ branding, bankInfo, about });
  }),
);

// Resolved (with its ropa/calzado/accesorios-or-oldest-3 fallback) so the
// Categorías page's star toggles pre-reflect what's already effectively
// shown on the home page, even before the admin ever explicitly saves one.
adminConfigRouter.get(
  '/featured-categories',
  asyncHandler(async (_req, res) => {
    res.json({ featuredCategoryIds: await resolveFeaturedCategoryIds() });
  }),
);

const brandingSchema = z.object({
  nombre: z.string().min(1),
  heroTitulo: z.string().min(1),
  heroDescripcion: z.string().min(1),
  pagoTarjetaActivo: z.boolean().default(true),
  pagoTransferenciaActivo: z.boolean().default(true),
  // null/omitted keeps the storefront's default background color.
  colorFondo: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Color inválido')
    .nullable()
    .optional(),
  // Required (no default) on purpose — every save from any branding tab in
  // the admin must echo back the currently-loaded value, or an unrelated
  // save (e.g. "Métodos de pago") would silently reset the chosen theme.
  temaId: z.nativeEnum(Tema),
  // Same "required, no default" reasoning as temaId — null means "the
  // tema's own built-in palette, no custom variant applied".
  temaVariantId: z.string().nullable(),
});

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const coloresSchema = z.object({
  bg: z.string().regex(HEX_COLOR, 'Color inválido'),
  surface: z.string().regex(HEX_COLOR, 'Color inválido'),
  text: z.string().regex(HEX_COLOR, 'Color inválido'),
  accent: z.string().regex(HEX_COLOR, 'Color inválido'),
  accent2: z.string().regex(HEX_COLOR, 'Color inválido'),
  onAccent: z.string().regex(HEX_COLOR, 'Color inválido'),
});

adminConfigRouter.put(
  '/branding',
  requireRole(...CONFIG_ROLES),
  asyncHandler(async (req, res) => {
    const data = brandingSchema.parse(req.body);
    // Plain check (not a zod .refine) so this rejects with a specific,
    // readable message instead of the generic "Datos inválidos" every
    // schema validation error gets — the client-side checkbox guard should
    // normally prevent this from ever being reachable anyway.
    if (!data.pagoTarjetaActivo && !data.pagoTransferenciaActivo) {
      throw new HttpError(400, 'Tiene que quedar activo al menos un método de pago');
    }
    // A variant only makes sense paired with the tema it was saved against —
    // guards against a stale client sending e.g. a Boutique Luxe variant id
    // while switching temaId to Street Bold.
    if (data.temaVariantId) {
      const variant = await prisma.themeVariant.findUnique({ where: { id: data.temaVariantId } });
      if (!variant || variant.tema !== data.temaId) {
        throw new HttpError(400, 'La variante de colores no corresponde a ese diseño');
      }
    }
    const update = {
      nombre: data.nombre,
      heroTitulo: data.heroTitulo,
      heroDescripcion: data.heroDescripcion,
      pagoTarjetaActivo: data.pagoTarjetaActivo,
      pagoTransferenciaActivo: data.pagoTransferenciaActivo,
      colorFondo: data.colorFondo ?? null,
      temaId: data.temaId,
      temaVariantId: data.temaVariantId,
    };
    const branding = await prisma.brandingConfig.upsert({
      where: { id: 1 },
      update,
      create: { id: 1, ...update },
      ...INCLUDE_TEMA_VARIANT,
    });
    res.json(branding);
  }),
);

// ─────────────────────────── Theme variants ───────────────────────────
// Saved, named re-colorings of a built-in tema — see ThemeVariant in
// schema.prisma for which 6 tokens are editable and why the rest of that
// tema's tokens (ramps, typography, radius, shadows) are left alone.

adminConfigRouter.get(
  '/theme-variants',
  asyncHandler(async (req, res) => {
    const temaFilter = typeof req.query.tema === 'string' ? req.query.tema : undefined;
    const variants = await prisma.themeVariant.findMany({
      where: temaFilter ? { tema: temaFilter as Tema } : undefined,
      orderBy: { createdAt: 'asc' },
    });
    res.json(variants);
  }),
);

const themeVariantSchema = z.object({
  tema: z.nativeEnum(Tema),
  nombre: z.string().min(1).max(60),
  colores: coloresSchema,
});

adminConfigRouter.post(
  '/theme-variants',
  requireRole(...CONFIG_ROLES),
  asyncHandler(async (req, res) => {
    const data = themeVariantSchema.parse(req.body);
    const variant = await prisma.themeVariant.create({ data });
    res.status(201).json(variant);
  }),
);

const themeVariantUpdateSchema = z.object({
  nombre: z.string().min(1).max(60),
  colores: coloresSchema,
});

adminConfigRouter.put(
  '/theme-variants/:id',
  requireRole(...CONFIG_ROLES),
  asyncHandler(async (req, res) => {
    const data = themeVariantUpdateSchema.parse(req.body);
    const existing = await prisma.themeVariant.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new HttpError(404, 'Variante no encontrada');
    const variant = await prisma.themeVariant.update({ where: { id: req.params.id }, data });
    res.json(variant);
  }),
);

adminConfigRouter.delete(
  '/theme-variants/:id',
  requireRole(...CONFIG_ROLES),
  asyncHandler(async (req, res) => {
    const existing = await prisma.themeVariant.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new HttpError(404, 'Variante no encontrada');
    // onDelete: SetNull on BrandingConfig.temaVariantId handles the case
    // where this variant is the one currently in use — the storefront just
    // falls back to that tema's plain built-in palette, no extra code here.
    await prisma.themeVariant.delete({ where: { id: req.params.id } });
    res.json({ id: req.params.id });
  }),
);

// No max() here — the admin can pick as many as they want; the UI just
// warns that going past 3 may hurt the home page's look instead of
// enforcing a hard cap.
const featuredCategoriesSchema = z.object({ featuredCategoryIds: z.array(z.string()) });

// Lives under /config (BrandingConfig is where it's stored) but is edited
// from the Categorías page, not the branding form — picking which
// categories are "destacadas" is a per-category toggle (star icon), not a
// store-identity setting.
adminConfigRouter.put(
  '/featured-categories',
  requireRole(...CONFIG_ROLES),
  asyncHandler(async (req, res) => {
    const { featuredCategoryIds } = featuredCategoriesSchema.parse(req.body);
    const branding = await prisma.brandingConfig.upsert({
      where: { id: 1 },
      update: { featuredCategoryIds },
      create: { id: 1, featuredCategoryIds },
    });
    res.json({ featuredCategoryIds: branding.featuredCategoryIds });
  }),
);

adminConfigRouter.post(
  '/branding/logo',
  requireRole(...CONFIG_ROLES),
  ...uploadImage.single('logo'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'No se recibió un archivo');
    const logoUrl = publicUrlFor(req.file.filename);
    const branding = await prisma.brandingConfig.upsert({
      where: { id: 1 },
      update: { logoUrl },
      create: { id: 1, logoUrl },
      ...INCLUDE_TEMA_VARIANT,
    });
    res.json(branding);
  }),
);

adminConfigRouter.post(
  '/branding/hero',
  requireRole(...CONFIG_ROLES),
  ...uploadImage.single('hero'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'No se recibió un archivo');
    const heroImageUrl = publicUrlFor(req.file.filename);
    const branding = await prisma.brandingConfig.upsert({
      where: { id: 1 },
      update: { heroImageUrl },
      create: { id: 1, heroImageUrl },
      ...INCLUDE_TEMA_VARIANT,
    });
    res.json(branding);
  }),
);

// Reverts the home hero back to the default gradient.
adminConfigRouter.delete(
  '/branding/hero',
  requireRole(...CONFIG_ROLES),
  asyncHandler(async (_req, res) => {
    const branding = await prisma.brandingConfig.upsert({
      where: { id: 1 },
      update: { heroImageUrl: null },
      create: { id: 1 },
      ...INCLUDE_TEMA_VARIANT,
    });
    res.json(branding);
  }),
);

const bankSchema = z.object({
  alias: z.string().default(''),
  banco: z.string().default(''),
  tipoCuenta: z.string().default(''),
  numero: z.string().default(''),
  identificacion: z.string().default(''),
  titular: z.string().default(''),
});

adminConfigRouter.put(
  '/bank-info',
  requireRole(...CONFIG_ROLES),
  asyncHandler(async (req, res) => {
    const data = bankSchema.parse(req.body);
    const bankInfo = await prisma.bankInfo.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
    res.json(bankInfo);
  }),
);

const aboutSchema = z.object({
  historia: z.string().default(''),
  anioFundacion: z.string().default(''),
  direccion: z.string().default(''),
  googleMapsUrl: z.string().default(''),
  telefono: z.string().default(''),
  emailContacto: z.string().default(''),
});

adminConfigRouter.put(
  '/about',
  requireRole(...CONFIG_ROLES),
  asyncHandler(async (req, res) => {
    const data = aboutSchema.parse(req.body);
    const about = await prisma.aboutContent.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
    res.json(about);
  }),
);

adminConfigRouter.post(
  '/about/foto-portada',
  requireRole(...CONFIG_ROLES),
  ...uploadImage.single('foto'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'No se recibió un archivo');
    const fotoPortadaUrl = publicUrlFor(req.file.filename);
    const about = await prisma.aboutContent.upsert({
      where: { id: 1 },
      update: { fotoPortadaUrl },
      create: { id: 1, fotoPortadaUrl },
    });
    res.json(about);
  }),
);

adminConfigRouter.post(
  '/about/foto-local',
  requireRole(...CONFIG_ROLES),
  ...uploadImage.single('foto'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'No se recibió un archivo');
    const fotoLocalUrl = publicUrlFor(req.file.filename);
    const about = await prisma.aboutContent.upsert({
      where: { id: 1 },
      update: { fotoLocalUrl },
      create: { id: 1, fotoLocalUrl },
    });
    res.json(about);
  }),
);

// Surfaced from the admin Pedidos page (not Configuración) since it's a
// order-verification behavior setting, not a store-identity one — see
// lib/verificationCron.ts for how toleranciaHoras is actually used.
adminConfigRouter.get(
  '/verification-settings',
  asyncHandler(async (_req, res) => {
    const settings = await prisma.verificationSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    res.json(settings);
  }),
);

const verificationSettingsSchema = z.object({ toleranciaHoras: z.number().int().min(1).max(720) });

adminConfigRouter.put(
  '/verification-settings',
  requireRole(...CONFIG_ROLES),
  asyncHandler(async (req, res) => {
    const data = verificationSettingsSchema.parse(req.body);
    const settings = await prisma.verificationSettings.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...data },
    });
    res.json(settings);
  }),
);
