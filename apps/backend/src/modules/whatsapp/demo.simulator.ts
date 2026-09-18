import { prisma } from '../../lib/prisma.js';
import { config } from '../../config.js';
import { handleIncomingMessages, handleStatusUpdates } from '../messages/message.service.js';
import { emitToWorkspace } from '../../realtime/socket.js';

const DEMO_CONTACTS = [
  { name: 'Rahul Sharma', company: 'Sharma Textiles', msg: 'Hi, I saw your products online. Can you share the catalog?' },
  { name: 'Priya Patel', company: 'Patel Retail', msg: 'Hello! How much does the premium plan cost for 3 months?' },
  { name: 'Amit Verma', company: 'Verma Traders', msg: 'We need 500 units urgently. What is the wholesale price?' },
  { name: 'Sneha Iyer', company: 'Iyer Interiors', msg: 'Can you arrange a demo call tomorrow at 4 PM?' },
  { name: 'Vikram Singh', company: 'Singh Motors', msg: 'Please send me the latest quotation for bulk order.' },
  { name: 'Neha Gupta', company: 'Gupta Electronics', msg: 'Is this product in stock? How fast is delivery?' },
  { name: 'Arjun Nair', company: 'Nair Exports', msg: 'I need to change my delivery address for order #1042.' },
  { name: 'Kavita Reddy', company: 'Reddy Foods', msg: 'Thanks for the quote! Please proceed with the order.' },
  { name: 'Rohan Joshi', company: 'Joshi Agencies', msg: 'Not interested right now, will contact later.' },
  { name: 'Deepa Menon', company: 'Menon Fashions', msg: 'Do you offer support for international shipping?' },
];

let interval: NodeJS.Timeout | null = null;
let started = false;

// Simulate provider status flow for an outbound message (sent -> delivered -> read)
export async function simulateDelivery(workspaceId: string, conversationId: string, messageId: string, externalMessageId?: string) {
  const schedule = async (delay: number, status: 'delivered' | 'read') => {
    setTimeout(async () => {
      try {
        await handleStatusUpdates(workspaceId, [
          { externalMessageId: externalMessageId ?? `demo_${messageId}`, status, timestamp: Date.now() },
        ]);
        void conversationId;
      } catch {
        // ignore
      }
    }, delay);
  };
  schedule(2000 + Math.random() * 2000, 'delivered');
  schedule(6000 + Math.random() * 4000, 'read');
}

// Occasionally simulate a customer reply (demo mode)
async function simulateInbound(workspaceId: string) {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { workspaceId },
      include: { contact: true },
      orderBy: { lastMessageAt: 'desc' },
      take: 8,
    });
    if (conversations.length === 0) return;

    const target = conversations[Math.floor(Math.random() * conversations.length)];
    const customerReplies = [
      'Okay, that sounds good. What about delivery time?',
      'Can you share the price breakdown?',
      'Let me check with my team and get back to you.',
      'The quotation you sent looks great. Let us proceed.',
      'Do you have this in other colors?',
      'Is there any discount for annual payment?',
      'Please send the payment link.',
      'Thanks! I will confirm by tomorrow.',
    ];
    const body = customerReplies[Math.floor(Math.random() * customerReplies.length)];

    await handleIncomingMessages(workspaceId, [
      {
        externalMessageId: `demo_in_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        from: target.contact.phone,
        to: '919000000000',
        type: 'text',
        body,
        timestamp: Date.now(),
      },
    ]);
    emitToWorkspace(workspaceId, 'demo:activity', { type: 'inbound', body });
  } catch (err) {
    // demo simulation should be resilient
  }
}

async function maybeSimulateNewLead(workspaceId: string) {
  try {
    if (Math.random() > 0.45) return;
    const c = DEMO_CONTACTS[Math.floor(Math.random() * DEMO_CONTACTS.length)];
    const phone = `91${Math.floor(7000000000 + Math.random() * 2000000000)}`;
    await handleIncomingMessages(workspaceId, [
      {
        externalMessageId: `demo_lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        from: phone,
        to: '919000000000',
        type: 'text',
        body: c.msg,
        timestamp: Date.now(),
      },
    ]);
    // Give the contact a proper name
    await prisma.contact.updateMany({ where: { phone }, data: { name: c.name, company: c.company } });
    void c;
  } catch {
    // ignore
  }
}

export function startDemoSimulator() {
  if (started) return;
  started = true;

  const tick = async () => {
    try {
      const workspaces = await prisma.workspace.findMany({ select: { id: true }, take: 5 });
      for (const ws of workspaces) {
        if (Math.random() < 0.75) await simulateInbound(ws.id);
        await maybeSimulateNewLead(ws.id);
      }
    } catch {
      // ignore
    }
  };

  interval = setInterval(tick, config.demoMessageIntervalMs);
  // first tick soon after boot
  setTimeout(tick, config.demoMessageIntervalMs / 2);
}

export function stopDemoSimulator() {
  if (interval) clearInterval(interval);
  interval = null;
  started = false;
}