import { Router } from 'express';
import { z } from 'zod';
import { AdminRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { asyncHandler, HttpError } from '@/lib/asyncHandler';
import { requireRole } from '@/middleware/adminAuth';
import { sendMail } from '@/lib/mailer';
import { renderEmailHtml } from '@/lib/emailTemplate';
import { ADMIN_ROLE_LABEL } from '@/lib/labels';
import { env } from '@/env';
import { generateInviteToken } from './auth.routes';

export const adminUsersRouter = Router();

// Rank-based hierarchy: a manager can only invite/edit/suspend users whose
// role ranks strictly below their own, and can never assign a role at or
// above their own rank (prevents self-escalation). Super Admin bypasses
// both checks. Editor de catálogo / Soporte can't manage anyone.
const ROLE_RANK: Record<AdminRole, number> = {
  SUPER_ADMIN: 3,
  ADMIN: 2,
  EDITOR_CATALOGO: 1,
  SOPORTE: 1,
};
const MANAGER_ROLES = ['SUPER_ADMIN', 'ADMIN'] as const;

function canManage(actingRole: AdminRole, targetRole: AdminRole) {
  if (actingRole === 'SUPER_ADMIN') return true;
  return ROLE_RANK[targetRole] < ROLE_RANK[actingRole];
}

adminUsersRouter.get(
  '/',
  requireRole(...MANAGER_ROLES),
  asyncHandler(async (_req, res) => {
    const users = await prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' } });
    res.json(
      users.map((u) => ({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, activo: u.activo })),
    );
  }),
);

const inviteSchema = z.object({
  nombre: z.string().default(''),
  email: z.string().email(),
  rol: z.enum(['SUPER_ADMIN', 'ADMIN', 'EDITOR_CATALOGO', 'SOPORTE']),
});

adminUsersRouter.post(
  '/invite',
  requireRole(...MANAGER_ROLES),
  asyncHandler(async (req, res) => {
    const data = inviteSchema.parse(req.body);
    if (!canManage(req.adminUser!.rol, data.rol as AdminRole)) {
      throw new HttpError(403, 'No podés invitar a alguien con un rol igual o superior al tuyo');
    }
    const existing = await prisma.adminUser.findUnique({ where: { email: data.email } });
    if (existing) throw new HttpError(409, 'Ya existe un usuario con ese email');

    const inviteToken = generateInviteToken();
    const user = await prisma.adminUser.create({
      data: {
        nombre: data.nombre || data.email,
        email: data.email,
        rol: data.rol as AdminRole,
        activo: false,
        inviteToken,
        invitedAt: new Date(),
      },
    });
    // The admin panel is served from the same domain as the storefront
    // (under /admin), so STORE_APP_URL is the right base here too — this used
    // to read an ADMIN_APP_URL that was never actually set anywhere, which
    // silently fell back to localhost in production.
    const acceptUrl = `${env.STORE_APP_URL}/admin/aceptar-invitacion?token=${inviteToken}`;
    const branding = await prisma.brandingConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    const html = renderEmailHtml({
      brandName: branding.nombre,
      logoUrl: branding.logoUrl,
      heading: 'Fuiste invitado al panel de administración',
      paragraphs: [
        `Te invitaron a unirte al panel de ${branding.nombre} con el rol de ${ADMIN_ROLE_LABEL[data.rol as AdminRole]}.`,
        'Hacé clic en el botón para configurar tu contraseña y activar tu cuenta.',
      ],
      cta: { label: 'Configurar mi acceso', url: acceptUrl },
      footerNote: 'Si no esperabas esta invitación, podés ignorar este correo.',
    });
    await sendMail(data.email, 'Invitación al panel admin', html);
    res.status(201).json({ id: user.id, nombre: user.nombre, email: user.email, rol: user.rol, activo: user.activo });
  }),
);

const roleSchema = z.object({ rol: z.enum(['SUPER_ADMIN', 'ADMIN', 'EDITOR_CATALOGO', 'SOPORTE']) });

adminUsersRouter.patch(
  '/:id/rol',
  requireRole(...MANAGER_ROLES),
  asyncHandler(async (req, res) => {
    const { rol } = roleSchema.parse(req.body);
    if (req.params.id === req.adminUser!.id) throw new HttpError(403, 'No podés cambiar tu propio rol');

    const target = await prisma.adminUser.findUnique({ where: { id: req.params.id } });
    if (!target) throw new HttpError(404, 'Usuario no encontrado');
    if (!canManage(req.adminUser!.rol, target.rol)) {
      throw new HttpError(403, 'No podés editar a alguien con un rol igual o superior al tuyo');
    }
    if (!canManage(req.adminUser!.rol, rol as AdminRole)) {
      throw new HttpError(403, 'No podés asignar un rol igual o superior al tuyo');
    }

    const user = await prisma.adminUser.update({ where: { id: req.params.id }, data: { rol } });
    res.json({ id: user.id, nombre: user.nombre, email: user.email, rol: user.rol, activo: user.activo });
  }),
);

const profileSchema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
});

// No requireRole here (unlike the routes below) — anyone can edit their OWN
// nombre/email regardless of rank, including EDITOR_CATALOGO/SOPORTE who
// can't manage anyone else. Editing someone ELSE's profile still needs
// manager rank + the usual "can't touch an equal-or-higher role" check.
adminUsersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = profileSchema.parse(req.body);
    const isSelf = req.params.id === req.adminUser!.id;
    const target = await prisma.adminUser.findUnique({ where: { id: req.params.id } });
    if (!target) throw new HttpError(404, 'Usuario no encontrado');

    if (!isSelf) {
      if (!(MANAGER_ROLES as readonly string[]).includes(req.adminUser!.rol)) {
        throw new HttpError(403, 'No tenés permiso para editar a otros usuarios');
      }
      if (!canManage(req.adminUser!.rol, target.rol)) {
        throw new HttpError(403, 'No podés editar a alguien con un rol igual o superior al tuyo');
      }
    }

    if (data.email.toLowerCase() !== target.email.toLowerCase()) {
      const emailTaken = await prisma.adminUser.findUnique({ where: { email: data.email } });
      if (emailTaken) throw new HttpError(409, 'Ya existe un usuario con ese email');
    }

    const user = await prisma.adminUser.update({
      where: { id: req.params.id },
      data: { nombre: data.nombre, email: data.email },
    });
    res.json({ id: user.id, nombre: user.nombre, email: user.email, rol: user.rol, activo: user.activo });
  }),
);

adminUsersRouter.patch(
  '/:id/toggle-activo',
  requireRole(...MANAGER_ROLES),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.adminUser!.id) throw new HttpError(403, 'No podés suspender tu propia cuenta');

    const existing = await prisma.adminUser.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new HttpError(404, 'Usuario no encontrado');
    if (!canManage(req.adminUser!.rol, existing.rol)) {
      throw new HttpError(403, 'No podés editar a alguien con un rol igual o superior al tuyo');
    }

    if (existing.activo && existing.rol === 'SUPER_ADMIN') {
      const otherActiveSuperAdmins = await prisma.adminUser.count({
        where: { rol: 'SUPER_ADMIN', activo: true, id: { not: existing.id } },
      });
      if (otherActiveSuperAdmins === 0) {
        throw new HttpError(400, 'No podés suspender al único Super Admin activo');
      }
    }

    const user = await prisma.adminUser.update({ where: { id: req.params.id }, data: { activo: !existing.activo } });
    res.json({ id: user.id, nombre: user.nombre, email: user.email, rol: user.rol, activo: user.activo });
  }),
);

adminUsersRouter.delete(
  '/:id',
  requireRole(...MANAGER_ROLES),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.adminUser!.id) throw new HttpError(403, 'No podés eliminar tu propia cuenta');

    const existing = await prisma.adminUser.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new HttpError(404, 'Usuario no encontrado');
    if (!canManage(req.adminUser!.rol, existing.rol)) {
      throw new HttpError(403, 'No podés eliminar a alguien con un rol igual o superior al tuyo');
    }

    if (existing.rol === 'SUPER_ADMIN') {
      const otherSuperAdmins = await prisma.adminUser.count({ where: { rol: 'SUPER_ADMIN', id: { not: existing.id } } });
      if (otherSuperAdmins === 0) throw new HttpError(400, 'No podés eliminar al único Super Admin');
    }

    await prisma.adminUser.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);
