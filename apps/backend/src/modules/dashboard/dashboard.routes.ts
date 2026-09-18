import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireWorkspace } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { prisma } from '../../lib/prisma.js';

const router = Router();

const rangeSchema = z.object({
  days: z.coerce.number().int().min(1).max(3650).default(30),
});

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// GET /api/dashboard - KPI cards, charts, activity, recent conversations, pipeline summary
router.get('/workspaces/:workspaceId/dashboard', authenticate, requireWorkspace, validate(rangeSchema, 'query'), async (req, res, next) => {
  try {
    const wsId = req.ws!.workspaceId;
    const days = Number(req.query.days) || 30;
    const since = new Date(Date.now() - days * 86400_000);
    const today = startOfToday();

    const [
      totalConversations,
      openConversations,
      newLeads,
      openDeals,
      wonDeals,
      totalRevenue,
      wonRevenue,
      contacts,
      customers,
      unreadCount,
      conversationsSince,
    ] = await Promise.all([
      prisma.conversation.count({ where: { workspaceId: wsId } }),
      prisma.conversation.count({ where: { workspaceId: wsId, status: 'open' } }),
      prisma.lead.count({ where: { workspaceId: wsId, createdAt: { gte: since } } }),
      prisma.deal.count({ where: { workspaceId: wsId, stage: { notIn: ['Won', 'Lost'] } } }),
      prisma.deal.count({ where: { workspaceId: wsId, stage: 'Won' } }),
      prisma.deal.aggregate({ where: { workspaceId: wsId }, _sum: { value: true } }),
      prisma.deal.aggregate({ where: { workspaceId: wsId, stage: 'Won' }, _sum: { value: true } }),
      prisma.contact.count({ where: { workspaceId: wsId } }),
      prisma.contact.count({ where: { workspaceId: wsId, customerType: 'Customer' } }),
      prisma.conversation.aggregate({ where: { workspaceId: wsId }, _sum: { unreadCount: true } }),
      prisma.conversation.findMany({ where: { workspaceId: wsId, lastMessageAt: { gte: since } }, select: { lastMessageAt: true, createdAt: true } }),
    ]);

    // conversation volume over time (by day)
    const buckets: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(since.getTime() + i * 86400_000);
      buckets[d.toISOString().slice(0, 10)] = 0;
    }
    for (const c of conversationsSince) {
      const key = (c.lastMessageAt ?? c.createdAt).toISOString().slice(0, 10);
      if (key in buckets) buckets[key]++;
    }

    // leads by day
    const leadsByDayRaw = await prisma.lead.findMany({
      where: { workspaceId: wsId, createdAt: { gte: since } },
      select: { createdAt: true },
    });
    const leadBuckets: Record<string, number> = {};
    for (const l of leadsByDayRaw) {
      const key = l.createdAt.toISOString().slice(0, 10);
      leadBuckets[key] = (leadBuckets[key] ?? 0) + 1;
    }

    // pipeline summary
    const pipelineRaw = await prisma.deal.groupBy({
      by: ['stage'],
      where: { workspaceId: wsId },
      _count: { _all: true },
      _sum: { value: true },
    });

    // today's activity
    const [followUpsToday, overdueTasks, upcomingTasks, pendingTasks, assignedToMe] = await Promise.all([
      prisma.task.count({ where: { workspaceId: wsId, dueDate: { gte: today, lt: new Date(today.getTime() + 86400_000) }, status: 'pending' } }),
      prisma.task.count({ where: { workspaceId: wsId, dueDate: { lt: new Date() }, status: 'pending' } }),
      prisma.task.count({ where: { workspaceId: wsId, dueDate: { gt: new Date() }, status: 'pending' } }),
      prisma.task.count({ where: { workspaceId: wsId, status: 'pending' } }),
      prisma.conversation.count({ where: { workspaceId: wsId, assignedToId: req.user!.id, status: 'open' } }),
    ]);

    // recent conversations
    const recentConversations = await prisma.conversation.findMany({
      where: { workspaceId: wsId },
      orderBy: { lastMessageAt: 'desc' },
      take: 8,
      include: {
        contact: { select: { id: true, name: true, phone: true, avatarUrl: true, leadStatus: true, tags: { include: { tag: true } } } },
        assignedTo: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    // recent activity
    const recentActivity = await prisma.activity.findMany({
      where: { workspaceId: wsId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { actor: { select: { id: true, name: true, avatarUrl: true } }, contact: { select: { id: true, name: true } } },
    });

    // agent performance
    const agents = await prisma.workspaceMember.findMany({
      where: { workspaceId: wsId },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    const agentIds = agents.map((a) => a.userId);
    const agentStats = await Promise.all(
      agentIds.map(async (id) => {
        const [convos, msgs, leads, deals] = await Promise.all([
          prisma.conversation.count({ where: { workspaceId: wsId, assignedToId: id } }),
          prisma.message.count({ where: { workspaceId: wsId, senderType: 'agent', senderId: id } }),
          prisma.lead.count({ where: { workspaceId: wsId, assignedToId: id } }),
          prisma.deal.count({ where: { workspaceId: wsId, assignedToId: id, stage: 'Won' } }),
        ]);
        return { userId: id, conversations: convos, messages: msgs, leads, dealsWon: deals };
      }),
    );

    const conversionRate = newLeads > 0 ? Math.round((wonDeals / newLeads) * 100) : 0;
    const avgResponseMinutes = await avgResponseTime(wsId, since);

    res.json({
      kpis: {
        totalConversations,
        openConversations,
        newLeads,
        openDeals,
        wonDeals,
        totalRevenue: Number(totalRevenue._sum.value ?? 0),
        wonRevenue: Number(wonRevenue._sum.value ?? 0),
        conversionRate,
        avgResponseMinutes,
        unreadCount: unreadCount._sum.unreadCount ?? 0,
        contacts,
        customers,
      },
      charts: {
        conversationsOverTime: Object.entries(buckets).map(([date, count]) => ({ date, count })),
        leadsOverTime: Object.entries(leadBuckets).map(([date, count]) => ({ date, count })),
        pipeline: pipelineRaw.map((p) => ({ stage: p.stage, count: p._count._all, value: Number(p._sum.value ?? 0) })),
      },
      today: { followUpsToday, overdueTasks, upcomingTasks, pendingTasks, assignedToMe },
      recentConversations: recentConversations.map((c) => ({
        ...c,
        contact: c.contact ? { ...c.contact, tags: c.contact.tags.map((t) => t.tag) } : null,
      })),
      recentActivity,
      agentPerformance: agentStats,
    });
  } catch (err) {
    next(err);
  }
});

async function avgResponseTime(workspaceId: string, since: Date): Promise<number> {
  // approximate: average time between customer message and next agent reply
  const convs = await prisma.conversation.findMany({
    where: { workspaceId, lastMessageAt: { gte: since } },
    select: { id: true },
    take: 50,
  });
  let total = 0;
  let count = 0;
  for (const c of convs) {
    const msgs = await prisma.message.findMany({
      where: { conversationId: c.id },
      orderBy: { createdAt: 'asc' },
      select: { senderType: true, createdAt: true },
      take: 100,
    });
    for (let i = 0; i < msgs.length - 1; i++) {
      if (msgs[i].senderType === 'customer' && msgs[i + 1].senderType === 'agent') {
        const diff = msgs[i + 1].createdAt.getTime() - msgs[i].createdAt.getTime();
        if (diff > 0 && diff < 24 * 3600_000) {
          total += diff;
          count++;
        }
      }
    }
  }
  return count ? Math.round(total / count / 60000) : 0;
}

export default router;