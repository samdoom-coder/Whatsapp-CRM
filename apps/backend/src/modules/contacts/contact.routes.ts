import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireWorkspace } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { logActivity, auditLog } from '../../lib/activity.js';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(160),
  phone: z.string().min(4).max(30),
  email: z.string().email().optional().nullable(),
  company: z.string().max(160).optional().nullable(),
  location: z.string().max(160).optional().nullable(),
  leadStatus: z.string().max(40).optional(),
  customerType: z.string().max(40).optional(),
  source: z.string().max(80).optional(),
  assignedToId: z.string().uuid().optional().nullable(),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(5000).optional(),
});

const updateSchema = createSchema.partial();

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  leadStatus: z.string().optional(),
  customerType: z.string().optional(),
  tag: z.string().optional(),
  assignedToId: z.string().optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

const contactInclude = {
  assignedTo: { select: { id: true, name: true, avatarUrl: true } },
  tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
} as const;

const toPublic = (c: any) => ({
  ...c,
  tags: c.tags?.map((t: any) => t.tag) ?? [],
  _count: undefined,
});

const publicContactSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  company: true,
  location: true,
  avatarUrl: true,
  leadStatus: true,
  leadScore: true,
  customerType: true,
  source: true,
  assignedToId: true,
  lastActivityAt: true,
  createdAt: true,
  updatedAt: true,
  assignedTo: { select: { id: true, name: true, avatarUrl: true } },
  tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
  _count: { select: { conversations: true, deals: true } },
};

// GET /api/contacts
router.get('/workspaces/:workspaceId/contacts', authenticate, requireWorkspace, validate(listSchema, 'query'), async (req, res, next) => {
  try {
    const q = req.query as unknown as z.infer<typeof listSchema>;
    const wsId = req.ws!.workspaceId;
    const where: Record<string, unknown> = { workspaceId: wsId };

    if (q.search) {
      const s = q.search;
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s } },
        { email: { contains: s, mode: 'insensitive' } },
        { company: { contains: s, mode: 'insensitive' } },
      ];
    }
    if (q.leadStatus) where.leadStatus = q.leadStatus;
    if (q.customerType) where.customerType = q.customerType;
    if (q.assignedToId) where.assignedToId = q.assignedToId;
    if (q.tag) where.tags = { some: { tag: { name: q.tag } } };

    const sortBy = (q.sortBy ?? 'createdAt') as string;
    const sortDir = q.sortDir ?? 'desc';
    const orderBy = { [sortBy]: sortDir };

    const [total, items] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        select: publicContactSelect,
        orderBy,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);

    res.json({
      items: items.map(toPublic),
      total,
      page: q.page,
      pageSize: q.pageSize,
      hasMore: q.page * q.pageSize < total,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/contacts/:contactId - full 360 profile
router.get('/workspaces/:workspaceId/contacts/:contactId', authenticate, requireWorkspace, async (req, res, next) => {
  try {
    const wsId = req.ws!.workspaceId;
    const contact = await prisma.contact.findFirst({
      where: { id: req.params.contactId, workspaceId: wsId },
      include: {
        assignedTo: { select: { id: true, name: true, avatarUrl: true } },
        tags: { include: { tag: true } },
        conversations: {
          orderBy: { lastMessageAt: 'desc' },
          include: {
            assignedTo: { select: { id: true, name: true } },
            _count: { select: { messages: true } },
          },
        },
        leads: { orderBy: { createdAt: 'desc' }, include: { assignedTo: { select: { id: true, name: true } } } },
        deals: {
          orderBy: { updatedAt: 'desc' },
          include: { assignedTo: { select: { id: true, name: true } }, tasks: true },
        },
        orders: { orderBy: { placedAt: 'desc' } },
        tasks: { orderBy: { dueDate: 'asc' }, include: { assignedTo: { select: { id: true, name: true } } } },
        notes: { orderBy: { createdAt: 'desc' }, include: { } },
        activities: { orderBy: { createdAt: 'desc' }, take: 50, include: { actor: { select: { id: true, name: true } } } },
      },
    });

    if (!contact) throw ApiError.notFound('Contact not found');

    // hydrate note authors
    const authorIds = [...new Set(contact.notes.map((n) => n.authorId).filter((id): id is string => !!id))];
    const authors = await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true, avatarUrl: true } });
    const authorMap = new Map(authors.map((a) => [a.id, a]));

    res.json({
      ...contact,
      tags: contact.tags.map((t) => t.tag),
      notes: contact.notes.map((n) => ({ ...n, author: n.authorId ? (authorMap.get(n.authorId) ?? null) : null })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/contacts
router.post('/workspaces/:workspaceId/contacts', authenticate, requireWorkspace, validate(createSchema), async (req, res, next) => {
  try {
    const wsId = req.ws!.workspaceId;
    const body = req.body as z.infer<typeof createSchema>;

    const existing = await prisma.contact.findUnique({ where: { phone: body.phone } });
    if (existing) throw ApiError.conflict('A contact with this phone number already exists');

    const contact = await prisma.contact.create({
      data: {
        workspaceId: wsId,
        name: body.name,
        phone: body.phone,
        email: body.email,
        company: body.company,
        location: body.location,
        leadStatus: body.leadStatus ?? 'New',
        customerType: body.customerType ?? 'Lead',
        source: body.source ?? 'Manual',
        assignedToId: body.assignedToId,
        tags: body.tags?.length
          ? {
              create: body.tags.map((name) => ({ tag: { connectOrCreate: { where: { workspaceId_name: { workspaceId: wsId, name } }, create: { workspaceId: wsId, name } } } })),
            }
          : undefined,
      },
      select: publicContactSelect,
    });

    if (body.notes) {
      await prisma.note.create({
        data: { workspaceId: wsId, contactId: contact.id, authorId: req.user!.id, body: body.notes },
      });
    }

    await logActivity({
      workspaceId: wsId,
      type: 'contact_created',
      title: `Contact created: ${contact.name}`,
      actorId: req.user!.id,
      contactId: contact.id,
    });
    await auditLog({ workspaceId: wsId, userId: req.user!.id, action: 'contact.created', entityType: 'contact', entityId: contact.id });

    res.status(201).json(toPublic(contact));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/contacts/:contactId
router.patch('/workspaces/:workspaceId/contacts/:contactId', authenticate, requireWorkspace, validate(updateSchema), async (req, res, next) => {
  try {
    const wsId = req.ws!.workspaceId;
    const contactId = req.params.contactId;
    const body = req.body as z.infer<typeof updateSchema>;

    const existing = await prisma.contact.findFirst({ where: { id: contactId, workspaceId: wsId } });
    if (!existing) throw ApiError.notFound('Contact not found');

    const { tags, notes, ...rest } = body;

    const data: Record<string, unknown> = { ...rest };
    if (tags) {
      // replace tags
      await prisma.contactTag.deleteMany({ where: { contactId } });
      data.tags = {
        create: tags.map((name: string) => ({ tag: { connectOrCreate: { where: { workspaceId_name: { workspaceId: wsId, name } }, create: { workspaceId: wsId, name } } } })),
      };
    }

    const contact = await prisma.contact.update({ where: { id: contactId }, data, select: publicContactSelect });

    if (notes) {
      await prisma.note.create({
        data: { workspaceId: wsId, contactId, authorId: req.user!.id, body: notes },
      });
    }

    await logActivity({
      workspaceId: wsId,
      type: 'contact_updated',
      title: `Contact updated: ${contact.name}`,
      actorId: req.user!.id,
      contactId,
    });
    await auditLog({ workspaceId: wsId, userId: req.user!.id, action: 'contact.updated', entityType: 'contact', entityId: contactId });

    res.json(toPublic(contact));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/contacts/:contactId
router.delete('/workspaces/:workspaceId/contacts/:contactId', authenticate, requireWorkspace, async (req, res, next) => {
  try {
    const wsId = req.ws!.workspaceId;
    const contactId = req.params.contactId;
    const contact = await prisma.contact.findFirst({ where: { id: contactId, workspaceId: wsId } });
    if (!contact) throw ApiError.notFound('Contact not found');

    await prisma.contact.delete({ where: { id: contactId } });
    await auditLog({ workspaceId: wsId, userId: req.user!.id, action: 'contact.deleted', entityType: 'contact', entityId: contactId });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;