import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireWorkspace } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { prisma } from '../../lib/prisma.js';

const router = Router();

const rangeSchema = z.object({
  days: z.coerce.number().int().min(1).max(3650).default(30),
});

const dateBuckets = (since: Date, days: number) => {
  const buckets: Record<string, { date: string; incoming: number; outgoing: number }> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 86400_000);
    buckets[d.toISOString().slice(0, 10)] = { date: d.toISOString().slice(0, 10), incoming: 0, outgoing: 0 };
  }
  return buckets;
};

// GET /api/analytics - full analytics dashboard
router.get('/workspaces/:workspaceId/analytics', authenticate, requireWorkspace, validate(rangeSchema, 'query'), async (req, res, next) => {
  try {
    const wsId = req.ws!.workspaceId;
    const days = Number(req.query.days) || 30;
    const since = new Date(Date.now() - days * 86400_000);

    // Messaging
    const [incomingCount, outgoingCount, messageSeries] = await Promise.all([
      prisma.message.count({ where: { workspaceId: wsId, senderType: 'customer', createdAt: { gte: since } } }),
      prisma.message.count({ where: { workspaceId: wsId, senderType: 'agent', createdAt: { gte: since } } }),
      prisma.message.findMany({
        where: { workspaceId: wsId, createdAt: { gte: since } },
        select: { createdAt: true, senderType: true },
      }),
    ]);

    const buckets = dateBuckets(since, days);
    for (const m of messageSeries) {
      const key = m.createdAt.toISOString().slice(0, 10);
      if (buckets[key]) {
        if (m.senderType === 'customer') buckets[key].incoming++;
        else buckets[key].outgoing++;
      }
    }
    const messagingSeries = Object.values(buckets);

    const [conversationCount, leads, qualifiedLeads, wonDeals, lostDeals, revenue, leadsSeriesRaw, newCustomers, returningCustomers] = await Promise.all([
      prisma.conversation.count({ where: { workspaceId: wsId, createdAt: { gte: since } } }),
      prisma.lead.count({ where: { workspaceId: wsId, createdAt: { gte: since } } }),
      prisma.lead.count({ where: { workspaceId: wsId, status: { in: ['Qualified', 'Converted'] } } }),
      prisma.deal.count({ where: { workspaceId: wsId, stage: 'Won', createdAt: { gte: since } } }),
      prisma.deal.count({ where: { workspaceId: wsId, stage: 'Lost', createdAt: { gte: since } } }),
      prisma.deal.aggregate({ where: { workspaceId: wsId, stage: 'Won', createdAt: { gte: since } }, _sum: { value: true } }),
      prisma.lead.findMany({ where: { workspaceId: wsId, createdAt: { gte: since } }, select: { createdAt: true } }),
      prisma.contact.count({ where: { workspaceId: wsId, customerType: 'Customer', createdAt: { gte: since } } }),
      prisma.contact.count({ where: { workspaceId: wsId, customerType: 'Customer', createdAt: { lt: since } } }),
    ]);

    const leadBuckets: Record<string, number> = {};
    for (const l of leadsSeriesRaw) {
      const key = l.createdAt.toISOString().slice(0, 10);
      leadBuckets[key] = (leadBuckets[key] ?? 0) + 1;
    }
    for (const d of Object.keys(buckets)) {
      if (!(d in leadBuckets)) leadBuckets[d] = 0;
    }
    const leadSeries = Object.entries(leadBuckets).map(([date, count]) => ({ date, count }));

    const revenueRaw = await prisma.deal.findMany({
      where: { workspaceId: wsId, stage: 'Won', createdAt: { gte: since } },
      select: { createdAt: true, value: true },
    });
    const revenueBuckets: Record<string, number> = {};
    for (const r of revenueRaw) {
      const key = r.createdAt.toISOString().slice(0, 10);
      revenueBuckets[key] = (revenueBuckets[key] ?? 0) + Number(r.value);
    }
    for (const d of Object.keys(buckets)) {
      if (!(d in revenueBuckets)) revenueBuckets[d] = 0;
    }
    const revenueSeries = Object.entries(revenueBuckets).map(([date, value]) => ({ date, value }));

    // Team performance
    const members = await prisma.workspaceMember.findMany({ where: { workspaceId: wsId }, include: { user: { select: { id: true, name: true, avatarUrl: true } } } });
    const team = [];
    for (const m of members) {
      const [convos, msgs, agentLeads, agentWon, agentRevenue, responseTime] = await Promise.all([
        prisma.conversation.count({ where: { workspaceId: wsId, assignedToId: m.userId } }),
        prisma.message.count({ where: { workspaceId: wsId, senderType: 'agent', senderId: m.userId, createdAt: { gte: since } } }),
        prisma.lead.count({ where: { workspaceId: wsId, assignedToId: m.userId, createdAt: { gte: since } } }),
        prisma.deal.count({ where: { workspaceId: wsId, assignedToId: m.userId, stage: 'Won' } }),
        prisma.deal.aggregate({ where: { workspaceId: wsId, assignedToId: m.userId, stage: 'Won' }, _sum: { value: true } }),
        avgAgentResponseMinutes(wsId, m.userId, since),
      ]);
      team.push({
        userId: m.userId,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        conversations: convos,
        messages: msgs,
        leads: agentLeads,
        dealsWon: agentWon,
        revenue: Number(agentRevenue._sum.value ?? 0),
        avgResponseMinutes: responseTime,
      });
    }

    const conversionRate = leads > 0 ? Math.round((wonDeals / leads) * 100) : 0;

    res.json({
      range: { days },
      messaging: {
        incoming: incomingCount,
        outgoing: outgoingCount,
        conversations: conversationCount,
        responseTime: Math.round((await overallResponseTime(wsId, since)) / 60000),
        series: messagingSeries,
      },
      sales: {
        leads,
        qualifiedLeads,
        conversionRate,
        dealsWon: wonDeals,
        dealsLost: lostDeals,
        revenue: Number(revenue._sum.value ?? 0),
        leadSeries,
        revenueSeries,
        dealBreakdown: [
          { name: 'Won', value: wonDeals },
          { name: 'Lost', value: lostDeals },
          { name: 'Open', value: await prisma.deal.count({ where: { workspaceId: wsId, stage: { notIn: ['Won', 'Lost'] } } }) },
        ],
      },
      customers: {
        newCustomers,
        returningCustomers,
        total: await prisma.contact.count({ where: { workspaceId: wsId, customerType: 'Customer' } }),
        retentionRate: newCustomers + returningCustomers > 0 ? Math.round((returningCustomers / (newCustomers + returningCustomers)) * 100) : 0,
      },
      team,
    });
  } catch (err) {
    next(err);
  }
});

async function avgAgentResponseMinutes(workspaceId: string, userId: string, since: Date): Promise<number> {
  const convs = await prisma.conversation.findMany({
    where: { workspaceId, assignedToId: userId, lastMessageAt: { gte: since } },
    select: { id: true },
    take: 30,
  });
  let total = 0;
  let count = 0;
  for (const c of convs) {
    const msgs = await prisma.message.findMany({
      where: { conversationId: c.id, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      select: { senderType: true, createdAt: true, senderId: true },
      take: 100,
    });
    for (let i = 0; i < msgs.length - 1; i++) {
      if (msgs[i].senderType === 'customer' && msgs[i + 1].senderType === 'agent' && msgs[i + 1].senderId === userId) {
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

async function overallResponseTime(workspaceId: string, since: Date): Promise<number> {
  const convs = await prisma.conversation.findMany({
    where: { workspaceId, lastMessageAt: { gte: since } },
    select: { id: true },
    take: 60,
  });
  let total = 0;
  let count = 0;
  for (const c of convs) {
    const msgs = await prisma.message.findMany({
      where: { conversationId: c.id, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      select: { senderType: true, createdAt: true, senderId: true },
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
  return count ? total / count : 0;
}

export default router;