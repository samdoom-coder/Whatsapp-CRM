import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireWorkspace, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { auditLog } from '../../lib/activity.js';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(120),
  category: z.enum(['UTILITY', 'MARKETING', 'AUTHENTICATION']).default('MARKETING'),
  language: z.string().max(10).default('en'),
  body: z.string().min(1).max(4000),
  status: z.enum(['draft', 'pending', 'approved', 'rejected']).default('approved'),
});

const updateSchema = createSchema.partial();

// GET /api/templates
router.get('/workspaces/:workspaceId/templates', authenticate, requireWorkspace, async (req, res, next) => {
  try {
    const where: Record<string, unknown> = { workspaceId: req.ws!.workspaceId };
    if (req.query.category) where.category = req.query.category;
    if (req.query.search) where.name = { contains: req.query.search as string, mode: 'insensitive' };
    const items = await prisma.messageTemplate.findMany({ where, orderBy: { updatedAt: 'desc' } });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// POST /api/templates
router.post('/workspaces/:workspaceId/templates', authenticate, requireWorkspace, requireRole('OWNER', 'ADMIN', 'MANAGER'), validate(createSchema), async (req, res, next) => {
  try {
    const existing = await prisma.messageTemplate.findFirst({ where: { workspaceId: req.ws!.workspaceId, name: req.body.name } });
    if (existing) throw ApiError.conflict('A template with this name already exists');
    const template = await prisma.messageTemplate.create({
      data: {
        workspaceId: req.ws!.workspaceId,
        ...req.body,
        variables: extractVariables(req.body.body),
      },
    });
    await auditLog({ workspaceId: req.ws!.workspaceId, userId: req.user!.id, action: 'template.created', entityType: 'template', entityId: template.id });
    res.status(201).json(template);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/templates/:templateId
router.patch('/workspaces/:workspaceId/templates/:templateId', authenticate, requireWorkspace, requireRole('OWNER', 'ADMIN', 'MANAGER'), validate(updateSchema), async (req, res, next) => {
  try {
    const template = await prisma.messageTemplate.findFirst({ where: { id: req.params.templateId, workspaceId: req.ws!.workspaceId } });
    if (!template) throw ApiError.notFound('Template not found');
    const data: Record<string, unknown> = { ...req.body };
    if (req.body.body) data.variables = extractVariables(req.body.body);
    const updated = await prisma.messageTemplate.update({ where: { id: template.id }, data });
    await auditLog({ workspaceId: req.ws!.workspaceId, userId: req.user!.id, action: 'template.edited', entityType: 'template', entityId: template.id });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/templates/:templateId
router.delete('/workspaces/:workspaceId/templates/:templateId', authenticate, requireWorkspace, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const template = await prisma.messageTemplate.findFirst({ where: { id: req.params.templateId, workspaceId: req.ws!.workspaceId } });
    if (!template) throw ApiError.notFound('Template not found');
    await prisma.messageTemplate.delete({ where: { id: template.id } });
    await auditLog({ workspaceId: req.ws!.workspaceId, userId: req.user!.id, action: 'template.deleted', entityType: 'template', entityId: template.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

function extractVariables(body: string): string[] {
  const matches = [...body.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)];
  return [...new Set(matches.map((m) => m[1]))];
}

export default router;