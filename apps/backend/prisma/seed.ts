import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Realistic Indian/global customer data
const CONTACTS = [
  { name: 'Rahul Sharma', phone: '919876543201', email: 'rahul.sharma@gmail.com', company: 'Sharma Textiles', location: 'Mumbai', type: 'Customer', status: 'Qualified', score: 88 },
  { name: 'Priya Patel', phone: '919812345602', email: 'priya.patel@outlook.com', company: 'Patel Retail', location: 'Ahmedabad', type: 'Lead', status: 'Contacted', score: 62 },
  { name: 'Amit Verma', phone: '919834567803', email: 'amit.verma@yahoo.com', company: 'Verma Traders', location: 'Delhi', type: 'Customer', status: 'Converted', score: 95 },
  { name: 'Sneha Iyer', phone: '919845678904', email: 'sneha.iyer@gmail.com', company: 'Iyer Interiors', location: 'Chennai', type: 'Lead', status: 'New', score: 40 },
  { name: 'Vikram Singh', phone: '919856789005', email: 'vikram.singh@gmail.com', company: 'Singh Motors', location: 'Jaipur', type: 'Lead', status: 'Qualified', score: 76 },
  { name: 'Neha Gupta', phone: '919867890106', email: 'neha.gupta@rediffmail.com', company: 'Gupta Electronics', location: 'Kanpur', type: 'Customer', status: 'Qualified', score: 82 },
  { name: 'Arjun Nair', phone: '919878901207', email: 'arjun.nair@gmail.com', company: 'Nair Exports', location: 'Kochi', type: 'Customer', status: 'Converted', score: 91 },
  { name: 'Kavita Reddy', phone: '919889012308', email: 'kavita.reddy@gmail.com', company: 'Reddy Foods', location: 'Hyderabad', type: 'Lead', status: 'Contacted', score: 55 },
  { name: 'Rohan Joshi', phone: '919890123409', email: 'rohan.joshi@gmail.com', company: 'Joshi Agencies', location: 'Pune', type: 'Lead', status: 'Unqualified', score: 12 },
  { name: 'Deepa Menon', phone: '919901234510', email: 'deepa.menon@gmail.com', company: 'Menon Fashions', location: 'Thiruvananthapuram', type: 'Customer', status: 'Qualified', score: 84 },
  { name: 'Mohammed Farhan', phone: '919912345611', email: 'farhan.m@gmail.com', company: 'Farhan Exports', location: 'Lucknow', type: 'Lead', status: 'Contacted', score: 48 },
  { name: 'Ananya Bose', phone: '919923456712', email: 'ananya.bose@gmail.com', company: 'Bose Boutique', location: 'Kolkata', type: 'Lead', status: 'New', score: 30 },
  { name: 'Suresh Kumar', phone: '919934567813', email: 'suresh.k@gmail.com', company: 'Kumar Wholesale', location: 'Coimbatore', type: 'Customer', status: 'Qualified', score: 78 },
  { name: 'Pooja Desai', phone: '919945678914', email: 'pooja.desai@gmail.com', company: 'Desai Designs', location: 'Surat', type: 'Lead', status: 'Qualified', score: 70 },
  { name: 'Rajesh Khanna', phone: '919956789015', email: 'rajesh.khanna@gmail.com', company: 'Khanna Distributors', location: 'Chandigarh', type: 'Lead', status: 'Contacted', score: 52 },
  { name: 'Lakshmi Narayan', phone: '919967890116', email: 'lakshmi.n@gmail.com', company: 'Narayan Traders', location: 'Visakhapatnam', type: 'Customer', status: 'Converted', score: 89 },
  { name: 'Gaurav Mehta', phone: '919978901217', email: 'gaurav.mehta@gmail.com', company: 'Mehta Solutions', location: 'Indore', type: 'Lead', status: 'New', score: 25 },
  { name: 'Ritika Kapoor', phone: '919989012318', email: 'ritika.kapoor@gmail.com', company: 'Kapoor Fashion', location: 'Mumbai', type: 'Customer', status: 'Qualified', score: 80 },
  { name: 'Nitin Chawla', phone: '919990123419', email: 'nitin.chawla@gmail.com', company: 'Chawla Enterprises', location: 'Ludhiana', type: 'Lead', status: 'Lost', score: 10 },
  { name: 'Shalini Rao', phone: '919901234520', email: 'shalini.rao@gmail.com', company: 'Rao Interiors', location: 'Bangalore', type: 'Customer', status: 'Qualified', score: 86 },
  { name: 'David Fernandes', phone: '919012345621', email: 'david.fernandes@gmail.com', company: 'Fernandes Traders', location: 'Goa', type: 'Lead', status: 'Contacted', score: 44 },
  { name: 'Harpreet Kaur', phone: '919023456722', email: 'harpreet.kaur@gmail.com', company: 'Kaur Sweets', location: 'Amritsar', type: 'Customer', status: 'Qualified', score: 74 },
  { name: 'Mahesh Babu', phone: '919034567823', email: 'mahesh.babu@gmail.com', company: 'Babu Logistics', location: 'Vijayawada', type: 'Lead', status: 'New', score: 33 },
  { name: 'Farida Khan', phone: '919045678924', email: 'farida.khan@gmail.com', company: 'Khan Boutique', location: 'Bhopal', type: 'Customer', status: 'Qualified', score: 79 },
  { name: 'Sunil Dutt', phone: '919056789025', email: 'sunil.dutt@gmail.com', company: 'Dutt Hardware', location: 'Nagpur', type: 'Lead', status: 'Contacted', score: 50 },
  { name: 'Ishita Sen', phone: '919067890126', email: 'ishita.sen@gmail.com', company: 'Sen Creations', location: 'Jodhpur', type: 'Lead', status: 'New', score: 28 },
  { name: 'Ramesh Iyer', phone: '919078901227', email: 'ramesh.iyer@gmail.com', company: 'Iyer Auto Parts', location: 'Madurai', type: 'Customer', status: 'Converted', score: 93 },
  { name: 'Ayesha Khan', phone: '919089012328', email: 'ayesha.khan@gmail.com', company: 'Ayesha Lifestyle', location: 'Hyderabad', type: 'Lead', status: 'Qualified', score: 68 },
  { name: 'Tom Hanks', phone: '14155550101', email: 'tom.hanks@example.com', company: 'Global Imports Inc', location: 'New York', type: 'Lead', status: 'New', score: 35 },
  { name: 'Sarah Chen', phone: '8613800138000', email: 'sarah.chen@example.com', company: 'Chen Trading', location: 'Singapore', type: 'Customer', status: 'Qualified', score: 72 },
  { name: 'Maria Garcia', phone: '34600123456', email: 'maria.garcia@example.com', company: 'Garcia Import', location: 'Madrid', type: 'Lead', status: 'Contacted', score: 46 },
  { name: 'John Smith', phone: '441234567890', email: 'john.smith@example.com', company: 'Smith & Co', location: 'London', type: 'Customer', status: 'Qualified', score: 81 },
  { name: 'Wei Zhang', phone: '8613912345678', email: 'wei.zhang@example.com', company: 'Zhang Industries', location: 'Shanghai', type: 'Lead', status: 'Contacted', score: 58 },
  { name: 'Priyanka Chopra', phone: '919098765432', email: 'priyanka.c@gmail.com', company: 'PC Ventures', location: 'Mumbai', type: 'Lead', status: 'Qualified', score: 77 },
];

const MESSAGE_THREADS: Array<{ contactIdx: number; thread: Array<{ sender: 'customer' | 'agent'; text: string }> }> = [
  {
    contactIdx: 0,
    thread: [
      { sender: 'customer', text: 'Hi! I saw your product catalog online. Can you share the full catalog?' },
      { sender: 'agent', text: 'Hello Rahul! Thank you for reaching out. I will send the catalog right away. What product category interests you most?' },
      { sender: 'customer', text: 'We are mainly interested in premium cotton fabrics for bulk order.' },
      { sender: 'agent', text: 'Great choice! Our premium cotton line is very popular. I will share the catalog and a wholesale price list.' },
      { sender: 'customer', text: 'Perfect. How many units can you supply per week?' },
      { sender: 'agent', text: 'We can supply up to 2,000 units per week for premium cotton. Would you like a sample first?' },
      { sender: 'customer', text: 'Yes please, send samples. Also what is your best wholesale price for 500 units?' },
    ],
  },
  {
    contactIdx: 1,
    thread: [
      { sender: 'customer', text: 'Hello, I want to know the price for your monthly plan.' },
      { sender: 'agent', text: 'Hi Priya! Our plans start at ₹4,999/month. Would you like me to share the full pricing comparison?' },
      { sender: 'customer', text: 'Yes, and do you offer a quarterly discount?' },
      { sender: 'agent', text: 'We do — 10% off on quarterly, 20% off on annual billing.' },
      { sender: 'customer', text: 'That sounds good. Can you schedule a call to discuss further?' },
    ],
  },
  {
    contactIdx: 2,
    thread: [
      { sender: 'customer', text: 'We need 500 units urgently. What is the wholesale price?' },
      { sender: 'agent', text: 'Hi Amit! For 500 units we can offer ₹185/unit wholesale. That includes packaging.' },
      { sender: 'customer', text: 'Can you do ₹175? Delivery before Friday is critical.' },
      { sender: 'agent', text: 'I can do ₹178/unit with delivery by Thursday. Does that work?' },
      { sender: 'customer', text: 'Deal! Send the quotation and we will confirm.' },
      { sender: 'agent', text: 'Quotation sent to your email. Please review and confirm to proceed.' },
    ],
  },
  {
    contactIdx: 3,
    thread: [
      { sender: 'customer', text: 'Hi, I would like a demo of your platform.' },
      { sender: 'agent', text: 'Hello Sneha! I would love to arrange that. Would tomorrow at 4 PM work for you?' },
      { sender: 'customer', text: 'Tomorrow 4 PM works. Can you send the meeting link?' },
    ],
  },
  {
    contactIdx: 4,
    thread: [
      { sender: 'customer', text: 'Please send me the latest quotation for the bulk order we discussed.' },
      { sender: 'agent', text: 'Sure Vikram! I have attached the updated quotation. It includes the volume discount we agreed on.' },
      { sender: 'customer', text: 'The quotation looks good. We are getting approval from finance this week.' },
    ],
  },
  {
    contactIdx: 5,
    thread: [
      { sender: 'customer', text: 'Is this product in stock? How fast is delivery?' },
      { sender: 'agent', text: 'Hi Neha! Yes, it is in stock. Delivery takes 3-5 working days across India.' },
      { sender: 'customer', text: 'Great, please place an order for 50 units.' },
      { sender: 'agent', text: 'Order placed! Your order number is #1042. Estimated delivery Friday.' },
    ],
  },
  {
    contactIdx: 6,
    thread: [
      { sender: 'customer', text: 'I need to change my delivery address for order #1042.' },
      { sender: 'agent', text: 'Hi Arjun! Please share the new delivery address and I will update it immediately.' },
      { sender: 'customer', text: 'New address: 42, Marine Drive, Kochi. Thanks!' },
      { sender: 'agent', text: 'Updated! Your order will now deliver to Marine Drive, Kochi.' },
    ],
  },
  {
    contactIdx: 7,
    thread: [
      { sender: 'customer', text: 'Thanks for the quote! Please proceed with the order.' },
      { sender: 'agent', text: 'Fantastic Kavita! I have confirmed your order for 200 units. Payment link sent to your email.' },
      { sender: 'customer', text: 'Payment done. When will it ship?' },
      { sender: 'agent', text: 'Shipping tomorrow with 2-day delivery. Thank you!' },
    ],
  },
  {
    contactIdx: 8,
    thread: [
      { sender: 'customer', text: 'Not interested right now, will contact later.' },
      { sender: 'agent', text: 'No problem Rohan! We will be here when you are ready. I will keep your details on file.' },
    ],
  },
  {
    contactIdx: 9,
    thread: [
      { sender: 'customer', text: 'Do you offer support for international shipping?' },
      { sender: 'agent', text: 'Hi Deepa! Yes, we ship internationally via air freight. Shipping costs depend on destination.' },
      { sender: 'customer', text: 'We ship to Dubai. What would the lead time be?' },
      { sender: 'agent', text: 'For Dubai, typically 5-7 business days door-to-door. I can prepare a detailed quote.' },
    ],
  },
  {
    contactIdx: 10,
    thread: [
      { sender: 'customer', text: 'Hello, can I get a price list for your products?' },
      { sender: 'agent', text: 'Hi! Certainly. Which category are you interested in?' },
      { sender: 'customer', text: 'We are looking at the full range for our export business.' },
    ],
  },
  {
    contactIdx: 11,
    thread: [
      { sender: 'customer', text: 'Do you have a showroom I can visit?' },
      { sender: 'agent', text: 'Hi Ananya! Yes, our flagship showroom is in Mumbai. Shall I book a slot for you?' },
    ],
  },
  {
    contactIdx: 12,
    thread: [
      { sender: 'customer', text: 'I want to renew my wholesale contract for next year.' },
      { sender: 'agent', text: 'Hi Suresh! Great to hear. I will send you the renewal terms and early-bird discount.' },
      { sender: 'customer', text: 'Please include the volume-based pricing in the renewal.' },
    ],
  },
  {
    contactIdx: 13,
    thread: [
      { sender: 'customer', text: 'Can I get a design consultation before ordering?' },
      { sender: 'agent', text: 'Of course Pooja! Our design team offers free consultations. When works for you?' },
      { sender: 'customer', text: 'Friday morning works best.' },
    ],
  },
  {
    contactIdx: 14,
    thread: [
      { sender: 'customer', text: 'Is there a minimum order quantity for your products?' },
      { sender: 'agent', text: 'Hi Rajesh! Yes, the MOQ is 100 units for most products.' },
    ],
  },
  {
    contactIdx: 15,
    thread: [
      { sender: 'customer', text: 'The last batch was excellent quality. Ordering again!' },
      { sender: 'agent', text: 'Wonderful to hear Lakshmi! I will process a repeat order with your usual terms.' },
    ],
  },
  {
    contactIdx: 16,
    thread: [
      { sender: 'customer', text: 'I need some info about your startup plan.' },
      { sender: 'agent', text: 'Hi Gaurav! Our startup plan is very popular. It starts at ₹2,999/month with all core features.' },
    ],
  },
  {
    contactIdx: 17,
    thread: [
      { sender: 'customer', text: 'The product I ordered last month — do you have it in navy blue?' },
      { sender: 'agent', text: 'Hi Ritika! Yes, we have the navy blue in stock now.' },
      { sender: 'customer', text: 'Great! Please reserve 10 units for me.' },
    ],
  },
  {
    contactIdx: 18,
    thread: [
      { sender: 'customer', text: 'The price is too high compared to other vendors.' },
      { sender: 'agent', text: 'I understand Nitin. We can offer a special discount for long-term contracts.' },
    ],
  },
  {
    contactIdx: 19,
    thread: [
      { sender: 'customer', text: 'Can you share your corporate catalog and rates?' },
      { sender: 'agent', text: 'Hi Shalini! Here is our corporate catalog. I will send the rates separately.' },
      { sender: 'customer', text: 'Received, thank you!' },
    ],
  },
  {
    contactIdx: 20,
    thread: [
      { sender: 'customer', text: 'Hi, do you export to Goa?' },
      { sender: 'agent', text: 'Hi David! Yes, we have a distribution network in Goa.' },
    ],
  },
  {
    contactIdx: 21,
    thread: [
      { sender: 'customer', text: 'The festive season order — is it confirmed?' },
      { sender: 'agent', text: 'Hi Harpreet! Yes, your festive order is confirmed and in production.' },
    ],
  },
  {
    contactIdx: 22,
    thread: [
      { sender: 'customer', text: 'Can you arrange a meeting with the sales manager?' },
      { sender: 'agent', text: 'Certainly! I can schedule you with our regional manager this week.' },
    ],
  },
  {
    contactIdx: 23,
    thread: [
      { sender: 'customer', text: 'I saw your ad on Instagram. What products do you recommend?' },
      { sender: 'agent', text: 'Hi Farida! Welcome! Based on our conversation, I would recommend our bestseller collection.' },
    ],
  },
  {
    contactIdx: 24,
    thread: [
      { sender: 'customer', text: 'Do you offer training for your tools?' },
      { sender: 'agent', text: 'Hi Sunil! Yes, we provide free onboarding training for all customers.' },
    ],
  },
  {
    contactIdx: 25,
    thread: [
      { sender: 'customer', text: 'How do I track my pending order?' },
      { sender: 'agent', text: 'Hi Ishita! I can share the tracking link for your order.' },
    ],
  },
  {
    contactIdx: 26,
    thread: [
      { sender: 'customer', text: 'Need spare parts for the machine purchased in June.' },
      { sender: 'agent', text: 'Hi Ramesh! We have spare parts in stock. Which model is it?' },
      { sender: 'customer', text: 'Model X2000. I need the belt and filter set.' },
      { sender: 'agent', text: 'Both in stock. I will ship them today.' },
    ],
  },
  {
    contactIdx: 27,
    thread: [
      { sender: 'customer', text: 'Can I get exclusive access to the new collection?' },
      { sender: 'agent', text: 'Hi Ayesha! As one of our valued partners, yes! I will add you to the early access list.' },
    ],
  },
  {
    contactIdx: 28,
    thread: [
      { sender: 'customer', text: 'Hello, we are looking for a reliable supplier for our retail chain.' },
      { sender: 'agent', text: 'Hi Tom! We would be honored to work with you. Let me set up a call with our export team.' },
    ],
  },
  {
    contactIdx: 29,
    thread: [
      { sender: 'customer', text: 'Do you ship to Singapore?' },
      { sender: 'agent', text: 'Hi Sarah! Yes, we ship to Singapore weekly. I will send you the shipping schedule.' },
    ],
  },
  {
    contactIdx: 30,
    thread: [
      { sender: 'customer', text: 'Hola, ¿hablan español?' },
      { sender: 'agent', text: 'Hi Maria! Our team can assist in English and Spanish. How can I help?' },
    ],
  },
  {
    contactIdx: 31,
    thread: [
      { sender: 'customer', text: 'We need to increase our order volume for Q3.' },
      { sender: 'agent', text: 'Hi John! Great news. I will prepare a volume forecast for Q3 with our capacity team.' },
    ],
  },
  {
    contactIdx: 32,
    thread: [
      { sender: 'customer', text: 'What payment methods do you accept for international orders?' },
      { sender: 'agent', text: 'Hi Wei! We accept bank transfer, letter of credit, and PayPal for international orders.' },
    ],
  },
  {
    contactIdx: 33,
    thread: [
      { sender: 'customer', text: 'Looking for a bulk deal for our boutique launch.' },
      { sender: 'agent', text: 'Hi Priyanka! Congratulations on the launch! I will prepare a special bulk package for you.' },
    ],
  },
];

const TEMPLATES = [
  {
    name: 'welcome_message',
    category: 'UTILITY',
    language: 'en',
    body: 'Hello {{customer_name}}, welcome to {{company_name}}! We are here to help you. How can we assist you today?',
  },
  {
    name: 'quotation_ready',
    category: 'UTILITY',
    language: 'en',
    body: 'Hi {{customer_name}}, your quotation is ready. The total for your order is {{deal_value}}. Please let us know if you have any questions.',
  },
  {
    name: 'follow_up_message',
    category: 'UTILITY',
    language: 'en',
    body: 'Hi {{customer_name}}, following up on our last conversation. Shall we schedule {{appointment_date}} to continue?',
  },
  {
    name: 'order_confirmation',
    category: 'UTILITY',
    language: 'en',
    body: 'Hi {{customer_name}}, your order has been confirmed. Thank you for choosing {{company_name}}!',
  },
  {
    name: 'promo_new_arrivals',
    category: 'MARKETING',
    language: 'en',
    body: 'Hi {{customer_name}}, new arrivals are here! Get 15% off this week only at {{company_name}}.',
  },
];

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  await prisma.$transaction([
    prisma.activity.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.message.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.contactTag.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.deal.deleteMany(),
    prisma.task.deleteMany(),
    prisma.note.deleteMany(),
    prisma.order.deleteMany(),
    prisma.messageTemplate.deleteMany(),
    prisma.automationRun.deleteMany(),
    prisma.automation.deleteMany(),
    prisma.webhookEvent.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.tag.deleteMany(),
    prisma.contact.deleteMany(),
    prisma.whatsappNumber.deleteMany(),
    prisma.whatsappAccount.deleteMany(),
    prisma.workspaceSetting.deleteMany(),
    prisma.workspaceMember.deleteMany(),
    prisma.user.deleteMany(),
    prisma.workspace.deleteMany(),
    prisma.organization.deleteMany(),
  ]);

  const hash = await bcrypt.hash('password123', 12);

  const org = await prisma.organization.create({ data: { name: 'Acme Corp', slug: 'acme-corp' } });
  const workspace = await prisma.workspace.create({
    data: {
      organizationId: org.id,
      name: 'Acme Sales',
      slug: 'acme-sales',
      companyName: 'Acme Solutions Pvt Ltd',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
    },
  });
  await prisma.workspaceSetting.create({ data: { workspaceId: workspace.id, replySignature: 'Warm regards,\nAcme Sales Team' } });

  // Users & roles
  const owner = await prisma.user.create({ data: { email: 'owner@acme.com', passwordHash: hash, name: 'Vikram Malhotra' } });
  const admin = await prisma.user.create({ data: { email: 'admin@acme.com', passwordHash: hash, name: 'Aditi Rao' } });
  const manager = await prisma.user.create({ data: { email: 'manager@acme.com', passwordHash: hash, name: 'Karan Shah' } });
  const agent1 = await prisma.user.create({ data: { email: 'agent@acme.com', passwordHash: hash, name: 'Rohan Gupta' } });
  const agent2 = await prisma.user.create({ data: { email: 'sam@acme.com', passwordHash: hash, name: 'Samay Verma' } });

  const roles = [
    { userId: owner.id, role: 'OWNER' },
    { userId: admin.id, role: 'ADMIN' },
    { userId: manager.id, role: 'MANAGER' },
    { userId: agent1.id, role: 'AGENT' },
    { userId: agent2.id, role: 'AGENT' },
  ] as const;
  for (const r of roles) {
    await prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId: r.userId, role: r.role } });
  }

  const account = await prisma.whatsappAccount.create({
    data: {
      workspaceId: workspace.id,
      businessAccountId: 'demo-ba-1234',
      phoneNumberId: '919000000000',
      webhookVerifyToken: 'my-webhook-verify-token',
      status: 'disconnected',
    },
  });
  await prisma.whatsappNumber.create({
    data: { workspaceId: workspace.id, accountId: account.id, phoneNumber: '919000000000', displayName: 'Acme Business', isPrimary: true },
  });

  // Tags
  const tagNames = [
    { name: 'VIP', color: '#f59e0b' },
    { name: 'New Lead', color: '#3b82f6' },
    { name: 'Returning Customer', color: '#10b981' },
    { name: 'High Intent', color: '#ef4444' },
    { name: 'Wholesale', color: '#8b5cf6' },
    { name: 'Export', color: '#06b6d4' },
    { name: 'Needs Follow-up', color: '#ec4899' },
    { name: 'Cold', color: '#94a3b8' },
  ];
  const tagMap: Record<string, string> = {};
  for (const t of tagNames) {
    const tag = await prisma.tag.create({ data: { workspaceId: workspace.id, name: t.name, color: t.color } });
    tagMap[t.name] = tag.id;
  }

  const agents = [agent1, agent2];
  const assignTags = (i: number, name: string, tags: string[]) =>
    tags.map((t) => ({ contactId: name, tagId: tagMap[t] }));

  // Contacts
  const contactIds: string[] = [];
  for (let i = 0; i < CONTACTS.length; i++) {
    const c = CONTACTS[i];
    const created = await prisma.contact.create({
      data: {
        workspaceId: workspace.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        company: c.company,
        location: c.location,
        customerType: c.type,
        leadStatus: c.status,
        leadScore: c.score,
        source: 'WhatsApp',
        assignedToId: agents[i % 2].id,
        lastActivityAt: new Date(Date.now() - i * 3600_000 * 4),
      },
    });
    contactIds.push(created.id);
  }
  // assign tags
  for (let i = 0; i < contactIds.length; i++) {
    const c = CONTACTS[i];
    const tags: string[] = [];
    if (c.type === 'Customer') tags.push('Returning Customer');
    if (c.score >= 70) tags.push('High Intent');
    if (i % 4 === 0) tags.push('VIP');
    if (i % 3 === 0) tags.push('Wholesale');
    if (c.company && /Export|Import|Global/i.test(c.company)) tags.push('Export');
    if (i % 5 === 0) tags.push('Needs Follow-up');
    if (c.score < 30) tags.push('Cold');
    if (c.status === 'New') tags.push('New Lead');
    await prisma.contactTag.createMany({ data: assignTags(i, contactIds[i], tags), skipDuplicates: true });
  }

  // Conversations + messages
  for (let i = 0; i < MESSAGE_THREADS.length; i++) {
    const thread = MESSAGE_THREADS[i];
    const contact = await prisma.contact.findUnique({ where: { id: contactIds[thread.contactIdx] } });
    if (!contact) continue;

    const baseTime = Date.now() - (MESSAGE_THREADS.length - i) * 3600_000 * 3;
    const conversation = await prisma.conversation.create({
      data: {
        workspaceId: workspace.id,
        contactId: contact.id,
        numberId: (await prisma.whatsappNumber.findFirst({ where: { workspaceId: workspace.id } }))?.id ?? null,
        status: i === 8 ? 'archived' : 'open',
        assignedToId: agents[i % 2].id,
        unreadCount: i % 4 === 0 ? 1 : 0,
        lastMessageAt: new Date(baseTime + thread.thread.length * 300_000),
      },
    });

    for (let j = 0; j < thread.thread.length; j++) {
      const m = thread.thread[j];
      const ts = new Date(baseTime + j * 300_000);
      const isCustomer = m.sender === 'customer';
      await prisma.message.create({
        data: {
          workspaceId: workspace.id,
          conversationId: conversation.id,
          senderType: isCustomer ? 'customer' : 'agent',
          senderId: isCustomer ? null : agents[i % 2].id,
          externalMessageId: `seed_${conversation.id}_${j}`,
          messageType: 'text',
          body: m.text,
          status: isCustomer ? 'read' : 'delivered',
          createdAt: ts,
          sentAt: ts,
          deliveredAt: new Date(ts.getTime() + 10_000),
          readAt: isCustomer ? ts : new Date(ts.getTime() + 60_000),
        },
      });
      await prisma.activity.create({
        data: {
          workspaceId: workspace.id,
          type: isCustomer ? 'message_received' : 'message_sent',
          title: isCustomer ? `Message received from ${contact.name}` : `Message sent to ${contact.name}`,
          contactId: contact.id,
          conversationId: conversation.id,
          actorId: isCustomer ? null : agents[i % 2].id,
          createdAt: ts,
        },
      });
    }
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageText: thread.thread[thread.thread.length - 1].text },
    });
  }

  // Leads
  const leadStatuses = ['New', 'Contacted', 'Qualified', 'Contacted', 'Qualified', 'Unqualified', 'New', 'Qualified', 'Lost', 'Contacted', 'New', 'Qualified', 'Contacted', 'Qualified', 'New'];
  const leadSources = ['WhatsApp', 'WhatsApp', 'Website', 'Referral', 'WhatsApp', 'WhatsApp', 'Instagram', 'Campaign', 'WhatsApp', 'WhatsApp', 'Website', 'WhatsApp', 'Referral', 'WhatsApp', 'Campaign'];
  for (let i = 0; i < 15; i++) {
    const c = CONTACTS[i];
    await prisma.lead.create({
      data: {
        workspaceId: workspace.id,
        contactId: contactIds[i],
        name: c.name,
        phone: c.phone,
        source: leadSources[i],
        status: leadStatuses[i],
        score: c.score,
        assignedToId: agents[i % 2].id,
        estimatedValue: (i * 15000 + 5000).toString(),
        expectedCloseDate: new Date(Date.now() + (i % 5 + 1) * 86400_000 * 3),
        notes: i % 3 === 0 ? 'Interested in bulk pricing. Follow up after quotation.' : undefined,
      },
    });
  }

  // Deals (pipeline)
  const dealStages = ['New Lead', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost', 'Proposal', 'Negotiation', 'Won'];
  const dealValues = [75000, 45000, 120000, 95000, 280000, 150000, 30000, 180000, 210000, 56000];
  const dealNames = [
    'Textile bulk order Q3', 'Retail partnership', 'Export contract - Dubai', 'Corporate interiors', 'Motor parts supply',
    'Food packaging deal', 'Fashion wholesale', 'Electronics distribution', 'Fabric supply - Chennai', 'Automotive spares',
  ];
  for (let i = 0; i < 10; i++) {
    const c = CONTACTS[i];
    await prisma.deal.create({
      data: {
        workspaceId: workspace.id,
        contactId: contactIds[i],
        name: dealNames[i],
        value: dealValues[i].toString(),
        stage: dealStages[i],
        probability: dealStages[i] === 'Won' ? 100 : dealStages[i] === 'Lost' ? 0 : [10, 20, 40, 60, 80][i % 5],
        expectedCloseDate: new Date(Date.now() + (i % 4 + 1) * 86400_000 * 5),
        assignedToId: agents[i % 2].id,
        wonAt: dealStages[i] === 'Won' ? new Date(Date.now() - (i % 3) * 86400_000 * 2) : null,
        notes: i === 4 ? 'Client wants delivery before Friday. Follow up on approval.' : undefined,
      },
    });
  }

  // Tasks / follow-ups
  const taskData: Array<{ title: string; contactIdx: number; days: number; priority: string; status: string; type: string }> = [
    { title: 'Follow up on quotation', contactIdx: 0, days: 0, priority: 'high', status: 'pending', type: 'follow_up' },
    { title: 'Call for demo scheduling', contactIdx: 3, days: 0, priority: 'high', status: 'pending', type: 'call' },
    { title: 'Send pricing comparison', contactIdx: 1, days: 1, priority: 'medium', status: 'pending', type: 'follow_up' },
    { title: 'Review contract renewal', contactIdx: 12, days: 2, priority: 'medium', status: 'pending', type: 'follow_up' },
    { title: 'Prepare export quote', contactIdx: 9, days: 3, priority: 'high', status: 'pending', type: 'follow_up' },
    { title: 'Send festive season order confirmation', contactIdx: 21, days: 4, priority: 'low', status: 'pending', type: 'follow_up' },
    { title: 'Follow up on sample feedback', contactIdx: 4, days: 5, priority: 'medium', status: 'pending', type: 'follow_up' },
    { title: 'Design consultation', contactIdx: 13, days: 6, priority: 'low', status: 'pending', type: 'meeting' },
    { title: 'Complete onboarding call', contactIdx: 24, days: -1, priority: 'medium', status: 'overdue', type: 'call' },
    { title: 'Follow up on approval', contactIdx: 14, days: -2, priority: 'high', status: 'pending', type: 'follow_up' },
    { title: 'Confirm Q3 volume forecast', contactIdx: 31, days: 7, priority: 'medium', status: 'pending', type: 'follow_up' },
    { title: 'Send bulk package for launch', contactIdx: 33, days: 1, priority: 'high', status: 'pending', type: 'follow_up' },
  ];
  for (const t of taskData) {
    await prisma.task.create({
      data: {
        workspaceId: workspace.id,
        title: t.title,
        type: t.type,
        priority: t.priority,
        status: t.status === 'overdue' ? 'pending' : t.status,
        dueDate: new Date(Date.now() + t.days * 86400_000),
        assignedToId: agents[t.contactIdx % 2].id,
        contactId: contactIds[t.contactIdx],
      },
    });
  }

  // Notes
  await prisma.note.create({ data: { workspaceId: workspace.id, contactId: contactIds[0], authorId: agent1.id, body: 'Customer is waiting for the quotation. Follow up tomorrow morning.' } });
  await prisma.note.create({ data: { workspaceId: workspace.id, contactId: contactIds[4], authorId: agent2.id, body: 'Negotiating on price. Can go down to ₹178/unit. Get approval from finance.' } });
  await prisma.note.create({ data: { workspaceId: workspace.id, contactId: contactIds[12], authorId: agent1.id, body: 'Wants to renew. Offer early-bird discount of 8% for annual contract.' } });

  // Orders
  await prisma.order.create({ data: { workspaceId: workspace.id, contactId: contactIds[2], orderNumber: 'ORD-1041', amount: '97500', placedAt: new Date(Date.now() - 10 * 86400_000) } });
  await prisma.order.create({ data: { workspaceId: workspace.id, contactId: contactIds[5], orderNumber: 'ORD-1042', amount: '45000', placedAt: new Date(Date.now() - 3 * 86400_000) } });
  await prisma.order.create({ data: { workspaceId: workspace.id, contactId: contactIds[7], orderNumber: 'ORD-1043', amount: '86000', placedAt: new Date(Date.now() - 2 * 86400_000) } });
  await prisma.order.create({ data: { workspaceId: workspace.id, contactId: contactIds[15], orderNumber: 'ORD-1044', amount: '145000', placedAt: new Date(Date.now() - 20 * 86400_000) } });
  await prisma.order.create({ data: { workspaceId: workspace.id, contactId: contactIds[26], orderNumber: 'ORD-1045', amount: '27500', placedAt: new Date(Date.now() - 5 * 86400_000) } });

  // Templates
  for (const t of TEMPLATES) {
    await prisma.messageTemplate.create({
      data: { workspaceId: workspace.id, name: t.name, category: t.category as any, language: t.language, body: t.body, status: 'approved' },
    });
  }

  // Automations
  await prisma.automation.create({
    data: {
      workspaceId: workspace.id,
      name: 'Hot lead → assign to sales team',
      description: 'When a new conversation comes in with high intent, assign to a sales agent and tag it.',
      triggerType: 'new_conversation',
      conditions: [{ field: 'contactScore', op: 'gt', value: 70 }],
      actions: [
        { type: 'add_tag', value: 'Hot Lead' },
        { type: 'create_task', value: { title: 'Follow up with hot lead', dueInHours: 24, priority: 'high' } },
      ],
      isEnabled: true,
    },
  });
  await prisma.automation.create({
    data: {
      workspaceId: workspace.id,
      name: 'New message → internal note',
      description: 'Adds a private note whenever a customer mentions pricing.',
      triggerType: 'new_message',
      conditions: [{ field: 'text', op: 'contains', value: 'price' }],
      actions: [{ type: 'add_note', value: 'Customer mentioned pricing — share quotation soon.' }],
      isEnabled: true,
    },
  });
  await prisma.automation.create({
    data: {
      workspaceId: workspace.id,
      name: 'Deal won → notify',
      description: 'Create follow-up task when a deal is won to ensure delivery follow-through.',
      triggerType: 'deal_stage_changed',
      conditions: [{ field: 'stage', op: 'eq', value: 'Won' }],
      actions: [{ type: 'create_task', value: { title: 'Post-sale delivery follow-up', dueInHours: 48, priority: 'medium' } }],
      isEnabled: true,
    },
  });

  console.log(`✅ Seeded ${CONTACTS.length} contacts, ${MESSAGE_THREADS.length} conversations, 15 leads, 10 deals, 12 tasks, 5 templates, 3 automations`);
  console.log('Login:');
  console.log('  owner@acme.com / password123');
  console.log('  agent@acme.com / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
void sleep;