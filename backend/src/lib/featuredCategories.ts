import { prisma } from '@/lib/prisma';

// Categories the admin explicitly picked always win. Until they pick any,
// fall back to whatever used to be hardcoded on the home page (the seed's
// ropa/calzado/accesorios ids) so existing stores see no visual change, or —
// if those don't exist — the oldest 3 categories.
export async function resolveFeaturedCategoryIds(): Promise<string[]> {
  const branding = await prisma.brandingConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  if (branding.featuredCategoryIds.length > 0) return branding.featuredCategoryIds;

  const legacyIds = ['ropa', 'calzado', 'accesorios'];
  const legacy = await prisma.category.findMany({ where: { id: { in: legacyIds } }, select: { id: true } });
  if (legacy.length > 0) return legacyIds.filter((id) => legacy.some((c) => c.id === id));

  const firstThree = await prisma.category.findMany({ orderBy: { createdAt: 'asc' }, take: 3, select: { id: true } });
  return firstThree.map((c) => c.id);
}
