import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireWorkspace } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';

const router = Router();

router.get('/workspaces/:workspaceId/tags', authenticate, requireWorkspace, async (_req, res, next) => {
  try {
    const tags = await prisma.tag.findMany({
      where: { workspaceId: res.req.ws!.workspaceId },
      include: { _count: { select: { contacts: true } } },
      orderBy: { name: 'asc' },
    });
    res.json({ items: tags });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  name: z.string().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#22c55e'),
});

router.post('/workspaces/:workspaceId/tags', authenticate, requireWorkspace, validate(createSchema), async (req, res, next) => {
  try {
    const wsId = res.req.ws!.workspaceId;
    const existing = await prisma.tag.findUnique({ where: { workspaceId_name: { workspaceId: wsId, name: req.body.name } } });
    if (existing) throw ApiError.conflict('Tag already exists');
    const tag = await prisma.tag.create({ data: { workspaceId: wsId, ...req.body } });
    res.status(201).json(tag);
  } catch (err) {
    next(err);
  }
});

router.delete('/workspaces/:workspaceId/tags/:tagId', authenticate, requireWorkspace, async (req, res, next) => {
  try {
    const tag = await prisma.tag.findFirst({ where: { id: req.params.tagId, workspaceId: res.req.ws!.workspaceId } });
    if (!tag) throw ApiError.notFound('Tag not found');
    await prisma.tag.delete({ where: { id: tag.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;