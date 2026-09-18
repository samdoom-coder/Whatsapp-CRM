import { config } from '../../config.js';

export interface ConversationTurn {
  sender: 'customer' | 'agent';
  text: string;
  ts: number;
}

export interface GenerateReplyOptions {
  tone: 'professional' | 'friendly' | 'short' | 'persuasive';
  context: string;
  customerName?: string;
}

export interface AIProvider {
  readonly name: string;
  summarizeConversation(turns: ConversationTurn[], maxPoints?: number): Promise<string[]>;
  generateReply(opts: GenerateReplyOptions): Promise<string>;
  scoreLead(info: { name: string; summary: string; score: number }): Promise<{ intent: string; confidence: number; temperature: 'Hot' | 'Warm' | 'Cold'; recommendedAction: string }>;
  classifyIntent(text: string): Promise<{ intent: string; confidence: number }>;
  extractCustomerData(text: string): Promise<{ name?: string; email?: string; company?: string; phone?: string }>;
}

// Deterministic local provider — no external dependency, works offline in demo mode.
class MockAIProvider implements AIProvider {
  readonly name = 'mock';

  async summarizeConversation(turns: ConversationTurn[], maxPoints = 4): Promise<string[]> {
    const customerTurns = turns.filter((t) => t.sender === 'customer').map((t) => t.text);
    if (customerTurns.length === 0) return ['No customer messages yet.'];

    const points = new Set<string>();
    for (const text of customerTurns) {
      const t = text.toLowerCase();
      if (/(price|cost|quote|quotation|pricing|how much)/.test(t)) points.add('Customer is asking about pricing.');
      if (/(order|buy|purchase|units|quantity|bulk|500|1000)/.test(t)) points.add('Customer is interested in placing an order.');
      if (/(demo|trial|call me|meeting|schedule|appointment)/.test(t)) points.add('Customer requested a demo or meeting.');
      if (/(delivery|ship|shipment|when|deadline|friday)/.test(t)) points.add('Customer has delivery timeline requirements.');
      if (/(discount|wholesale|b2b|annual|yearly)/.test(t)) points.add('Customer is looking for a discount or wholesale terms.');
      if (/(not interested|no thanks|stop|too expensive)/.test(t)) points.add('Customer showed low interest or objections.');
      if (/(color|size|variant|model|option)/.test(t)) points.add('Customer asked about product options/variants.');
    }

    const list = [...points];
    if (list.length === 0) list.push('General enquiry — no strong purchase signals yet.');
    return list.slice(0, maxPoints);
  }

  async generateReply(opts: GenerateReplyOptions): Promise<string> {
    const t = opts.context.toLowerCase();
    let reply: string;

    if (/(price|cost|quote|quotation|pricing|how much)/.test(t)) {
      reply = 'Thanks for your interest! I can share a detailed quotation — could you confirm the quantity you need and your delivery deadline? I will have pricing ready for you shortly.';
    } else if (/(order|buy|purchase|units|500|bulk)/.test(t)) {
      reply = 'Great to hear you are interested in placing an order. Let me check stock and share a formal quotation with volume pricing. Could you confirm your company name and delivery address?';
    } else if (/(demo|trial|call|meeting|schedule)/.test(t)) {
      reply = 'I would be happy to arrange a quick demo. Which time works best for you tomorrow — morning or afternoon? I will send you a calendar invite.';
    } else if (/(delivery|ship|when|deadline)/.test(t)) {
      reply = 'We typically deliver within 3-5 working days. If you have a tight deadline, I can prioritize your order — just let me know the date you need it by.';
    } else if (/(discount|wholesale|b2b|annual)/.test(t)) {
      reply = 'We do offer special pricing for volume orders. If you share the quantity, I can prepare a custom quotation with the best rate.';
    } else {
      reply = 'Thank you for reaching out! I have noted your message and will get back to you with the details shortly. Is there anything else I can help you with?';
    }

    if (opts.tone === 'short') {
      reply = reply.split('.')[0] + '.';
    } else if (opts.tone === 'friendly') {
      reply = `Hi${opts.customerName ? ' ' + opts.customerName : ''}! 😊 ${reply}`;
    } else if (opts.tone === 'persuasive') {
      reply = `${reply} Many of our clients see results within the first week — let's get you started today.`;
    } else {
      reply = `${reply}`;
    }
    return reply;
  }

  async scoreLead(info: { name: string; summary: string; score: number }): Promise<{ intent: string; confidence: number; temperature: 'Hot' | 'Warm' | 'Cold'; recommendedAction: string }> {
    const s = info.summary.toLowerCase();
    const wantsPrice = /price|quote|quotation|pricing/.test(s);
    const wantsOrder = /order|buy|purchase|units/.test(s);
    const wantsDemo = /demo|trial|meeting|call/.test(s);

    if (info.score >= 60 || wantsOrder) {
      return {
        intent: 'Purchase',
        confidence: 90 + Math.min(9, Math.floor(info.score / 10)),
        temperature: 'Hot',
        recommendedAction: 'Send a quotation immediately and schedule a follow-up within 24 hours.',
      };
    }
    if (wantsPrice || wantsDemo) {
      return {
        intent: 'Purchase consideration',
        confidence: 72,
        temperature: 'Warm',
        recommendedAction: 'Share pricing details and nurture with relevant content.',
      };
    }
    if (info.score <= 20) {
      return {
        intent: 'Not determined',
        confidence: 55,
        temperature: 'Cold',
        recommendedAction: 'Send a follow-up message in 48 hours to re-engage.',
      };
    }
    return {
      intent: 'Purchase',
      confidence: 68,
      temperature: 'Warm',
      recommendedAction: 'Follow up and qualify budget and timeline.',
    };
  }

  async classifyIntent(text: string): Promise<{ intent: string; confidence: number }> {
    const t = text.toLowerCase();
    if (/(price|quote|quotation|pricing|cost)/.test(t)) return { intent: 'Pricing enquiry', confidence: 92 };
    if (/(order|buy|purchase|book)/.test(t)) return { intent: 'Purchase intent', confidence: 94 };
    if (/(demo|trial|meeting|call)/.test(t)) return { intent: 'Demo request', confidence: 91 };
    if (/(support|help|issue|problem|refund|return)/.test(t)) return { intent: 'Support request', confidence: 93 };
    if (/(cancel|stop|not interested)/.test(t)) return { intent: 'Unsubscribe / not interested', confidence: 88 };
    return { intent: 'General enquiry', confidence: 60 };
  }

  async extractCustomerData(text: string): Promise<{ name?: string; email?: string; company?: string; phone?: string }> {
    const email = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0];
    const phone = text.match(/(?:\+91|0)?[6-9]\d{9}/)?.[0];
    const nameMatch = text.match(/I am ([A-Z][a-z]+(?: [A-Z][a-z]+)?)/) ?? text.match(/name is ([A-Z][a-z]+(?: [A-Z][a-z]+)?)/i);
    return {
      name: nameMatch?.[1],
      email,
      phone: phone ? `91${phone.slice(-10)}` : undefined,
    };
  }
}

// Reserved for real LLM providers. Implement Anthropic/OpenAI by adding a provider here.
class LlmAIProvider implements AIProvider {
  readonly name = 'llm';
  constructor(private baseUrl: string, private apiKey: string, private model: string) {}

  private async chat(prompt: string, system: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 400,
      }),
    });
    if (!res.ok) throw new Error(`AI provider error ${res.status}`);
    const json = (await res.json()) as any;
    return json?.choices?.[0]?.message?.content ?? '';
  }

  async summarizeConversation(turns: ConversationTurn[], maxPoints = 4): Promise<string[]> {
    const transcript = turns.map((t) => `${t.sender.toUpperCase()}: ${t.text}`).join('\n');
    const out = await this.chat(
      `Summarize this conversation into at most ${maxPoints} concise bullet points. Return as JSON array of strings.\n\n${transcript}`,
      'You are a CRM sales assistant.',
    );
    try {
      const parsed = JSON.parse(out);
      return Array.isArray(parsed) ? parsed.map(String) : [out];
    } catch {
      return [out];
    }
  }

  async generateReply(opts: GenerateReplyOptions): Promise<string> {
    return this.chat(
      `Customer context: ${opts.context}\nTone: ${opts.tone}${opts.customerName ? `\nCustomer name: ${opts.customerName}` : ''}\n\nWrite a WhatsApp reply from the business.`,
      'You are a professional sales agent writing concise WhatsApp replies.',
    );
  }

  async scoreLead(info: { name: string; summary: string; score: number }): Promise<{ intent: string; confidence: number; temperature: 'Hot' | 'Warm' | 'Cold'; recommendedAction: string }> {
    const out = await this.chat(
      `Lead: ${info.name}\nScore: ${info.score}/100\nSummary: ${info.summary}\n\nReturn JSON: {"intent": string, "confidence": number, "temperature": "Hot"|"Warm"|"Cold", "recommendedAction": string}`,
      'You are a lead qualification assistant.',
    );
    try {
      return JSON.parse(out);
    } catch {
      return { intent: 'Purchase', confidence: 70, temperature: 'Warm', recommendedAction: 'Follow up to qualify.' };
    }
  }

  async classifyIntent(text: string): Promise<{ intent: string; confidence: number }> {
    const out = await this.chat(`Classify the intent of: "${text}". Return JSON: {"intent": string, "confidence": 0-100}`, 'You are an intent classifier.');
    try {
      return JSON.parse(out);
    } catch {
      return { intent: 'General enquiry', confidence: 60 };
    }
  }

  async extractCustomerData(text: string): Promise<{ name?: string; email?: string; company?: string; phone?: string }> {
    const out = await this.chat(
      `Extract customer data from: "${text}". Return JSON with optional name, email, company, phone.`,
      'You are a data extraction assistant.',
    );
    try {
      return JSON.parse(out);
    } catch {
      return {};
    }
  }
}

let provider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (provider) return provider;
  if (config.ai.provider === 'llm' && config.ai.apiKey) {
    provider = new LlmAIProvider('https://api.anthropic.com', config.ai.apiKey, 'claude-3-5-sonnet-latest');
  } else {
    provider = new MockAIProvider();
  }
  return provider;
}