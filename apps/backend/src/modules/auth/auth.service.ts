import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { signSession } from '../../lib/jwt.js';
import { ApiError } from '../../lib/errors.js';
import { auditLog } from '../../lib/activity.js';

export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  workspaceName: z.string().min(1, 'Workspace name is required').max(120).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotSchema = z.object({ email: z.string().email() });
export const resetSchema = z.object({ token: z.string().min(1), password: z.string().min(8) });

const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export async function register(input: z.infer<typeof registerSchema>) {
  const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
      emailVerifiedAt: new Date(), // demo: auto-verify
    },
  });

  const slug = `${(input.workspaceName ?? `${input.name}'s Workspace`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${user.id.slice(0, 6)}`;

  const workspace = await prisma.workspace.create({
    data: {
      name: input.workspaceName ?? `${input.name}'s Workspace`,
      slug,
      companyName: input.workspaceName ?? '',
      organization: {
        create: { name: input.workspaceName ?? `${input.name}'s Workspace`, slug: `${slug}-org` },
      },
    },
  });

  await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: user.id, role: 'OWNER' },
  });

  await auditLog({ workspaceId: workspace.id, userId: user.id, action: 'user.registered', entityType: 'user', entityId: user.id });

  const token = await signSession({ sub: user.id, email: user.email });
  return { token, user: publicUser(user), workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug } };
}

export async function login(input: z.infer<typeof loginSchema>, ip?: string) {
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user) throw ApiError.unauthorized('Invalid email or password');
  if (!user.isActive) throw ApiError.forbidden('This account has been disabled');

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw ApiError.unauthorized('Invalid email or password');

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: user.id, isActive: true },
    include: { workspace: { select: { id: true, name: true, slug: true, companyName: true } } },
  });

  await auditLog({ userId: user.id, action: 'auth.login', metadata: { ip } });

  const token = await signSession({ sub: user.id, email: user.email });
  return {
    token,
    user: publicUser(user),
    workspaces: memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      companyName: m.workspace.companyName,
      role: m.role,
    })),
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User not found');
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId, isActive: true },
    include: { workspace: { select: { id: true, name: true, slug: true, companyName: true } } },
  });
  return {
    user: publicUser(user),
    workspaces: memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      companyName: m.workspace.companyName,
      role: m.role,
    })),
  };
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  // Always succeed to avoid user enumeration; only create token if user exists
  if (user) {
    const token = randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    // In a real deployment, email this token. Return it in dev/demo mode.
    return { resetToken: process.env.NODE_ENV === 'production' ? undefined : token };
  }
  return { resetToken: undefined };
}

export async function resetPassword(token: string, newPassword: string) {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw ApiError.badRequest('This reset link is invalid or has expired');
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
  return { ok: true };
}

const publicUser = (u: { id: string; name: string; email: string; avatarUrl: string | null }) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  avatarUrl: u.avatarUrl,
});