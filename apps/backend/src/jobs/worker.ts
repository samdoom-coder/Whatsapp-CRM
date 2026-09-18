import { Queue, Worker, QueueEvents } from 'bullmq';
import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { notifyUser } from '../modules/notifications/notification.routes.js';

export const queues = {
  followups: new Queue('followups', { connection: redis }),
  notifications: new Queue('notifications', { connection: redis }),
  automations: new Queue('automations', { connection: redis }),
};

export async function enqueueFollowupReminder(params: { taskId: string; workspaceId: string; dueAt: Date }) {
  await queues.followups.add(
    'reminder',
    { taskId: params.taskId, workspaceId: params.workspaceId },
    {
      jobId: `followup:${params.taskId}`,
      delay: Math.max(0, params.dueAt.getTime() - Date.now()),
      attempts: 3,
      backoff: { type: 'exponential', delay: 60_000 },
    },
  );
}

export async function enqueueNotification(params: { workspaceId: string; userId: string; type: string; title: string; body?: string; link?: string; data?: Record<string, unknown>; delayMs?: number }) {
  await queues.notifications.add(
    'notify',
    params,
    {
      attempts: 5,
      backoff: { type: 'exponential', delay: 30_000 },
      ...(params.delayMs ? { delay: params.delayMs } : {}),
    },
  );
}

// Scan for due follow-ups on startup and schedule reminders
export async function scheduleDueFollowups() {
  const tasks = await prisma.task.findMany({
    where: { status: 'pending', dueDate: { not: null } },
    select: { id: true, workspaceId: true, dueDate: true },
  });
  for (const t of tasks) {
    if (!t.dueDate) continue;
    // schedule reminder ~30 minutes before due, or now if overdue
    const remindAt = new Date(t.dueDate.getTime() - 30 * 60_000);
    await enqueueFollowupReminder({
      taskId: t.id,
      workspaceId: t.workspaceId,
      dueAt: remindAt < new Date() ? new Date(Date.now() + 60_000) : remindAt,
    }).catch(() => {});
  }
  logger.info(`Scheduled ${tasks.length} follow-up reminders`);
}

let started = false;

export async function startWorker() {
  if (started) return;
  started = true;

  const followupWorker = new Worker(
    'followups',
    async (job) => {
      const { taskId, workspaceId } = job.data as { taskId: string; workspaceId: string };
      const task = await prisma.task.findFirst({
        where: { id: taskId, workspaceId },
        include: { contact: { select: { id: true, name: true } }, assignedTo: { select: { id: true } } },
      });
      if (!task || task.status !== 'pending') return { skipped: true };

      const targetUserId = task.assignedToId ?? (await prisma.workspaceMember.findFirst({ where: { workspaceId, role: 'ADMIN' }, select: { userId: true } }))?.userId;
      if (targetUserId) {
        await notifyUser({
          workspaceId,
          userId: targetUserId,
          type: task.dueDate && task.dueDate < new Date() ? 'task_overdue' : 'follow_up_due',
          title: task.dueDate && task.dueDate < new Date() ? `Overdue: ${task.title}` : `Follow-up due: ${task.title}`,
          body: task.contact ? `Regarding ${task.contact.name}` : undefined,
          link: task.contact ? `/contacts/${task.contact.id}` : '/tasks',
          data: { taskId: task.id },
        });
      }
      return { ok: true };
    },
    { connection: redis },
  );

  const notificationWorker = new Worker(
    'notifications',
    async (job) => {
      const params = job.data as { workspaceId: string; userId: string; type: string; title: string; body?: string; link?: string; data?: Record<string, unknown> };
      await notifyUser(params);
      return { ok: true };
    },
    { connection: redis },
  );

  followupWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err.message }, 'followup job failed'));
  notificationWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err.message }, 'notification job failed'));

  await scheduleDueFollowups();

  // reschedule followups every 10 minutes (covers newly created tasks)
  setInterval(() => scheduleDueFollowups().catch(() => {}), 10 * 60_000);
}

export { QueueEvents };
void QueueEvents;