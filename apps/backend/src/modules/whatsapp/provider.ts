import type { WhatsAppProvider, SendMessageOptions, OutboundMessageResult, MessageStatus } from './provider.interface.js';
import { config } from '../../config.js';

// Demo provider. Simulates the WhatsApp Cloud API locally so the app runs
// without any real WhatsApp credentials. Marked clearly as demo.
export class DemoWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'demo';
  readonly isDemo = true;

  async sendMessage(to: string, text: string, options?: SendMessageOptions): Promise<OutboundMessageResult> {
    // simulate network latency
    await new Promise((r) => setTimeout(r, 80 + Math.random() * 200));
    return {
      externalMessageId: `demo_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      status: 'sent',
    };
  }

  async sendTemplate(to: string, _templateName: string, _language: string, _bodyVariables?: string[]): Promise<OutboundMessageResult> {
    await new Promise((r) => setTimeout(r, 100));
    return {
      externalMessageId: `demo_tpl_${Date.now()}`,
      status: 'sent',
    };
  }

  async markAsRead(_messageId: string): Promise<void> {
    // no-op in demo
  }

  parseWebhook(payload: unknown): {
    messages: never[];
    statuses: never[];
    errors: never[];
  } {
    // Demo provider never receives real webhooks; incoming traffic is simulated by the demo simulator.
    return { messages: [], statuses: [], errors: [] };
  }

  verifyWebhook(): string | null {
    return null;
  }
}

// Official WhatsApp Business Platform / Cloud API provider.
export class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'meta';
  readonly isDemo = false;

  private get apiUrl() {
    return 'https://graph.facebook.com/v20.0';
  }

  private get accessToken() {
    return config.whatsapp.accessToken;
  }

  private get phoneNumberId() {
    return config.whatsapp.phoneNumberId;
  }

  private assertConfigured() {
    if (!this.accessToken || !this.phoneNumberId) {
      throw new Error('WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID must be configured');
    }
  }

  private async post(path: string, body: unknown): Promise<{ data?: any; error?: { message?: string } }> {
    const res = await fetch(`${this.apiUrl}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.accessToken}` },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { data?: any; error?: { message?: string } };
    if (!res.ok || json.error) {
      throw new Error(`WhatsApp API error: ${json.error?.message ?? res.statusText}`);
    }
    return json;
  }

  async sendMessage(to: string, text: string, options?: SendMessageOptions): Promise<OutboundMessageResult> {
    this.assertConfigured();

    if (options?.mediaUrl && options?.mediaType) {
      const body: Record<string, unknown> = {
        messaging_product: 'whatsapp',
        to,
        type: options.mediaType,
        [options.mediaType]: { link: options.mediaUrl, filename: options.fileName, caption: options.caption },
      };
      const result = await this.post(`${this.phoneNumberId}/messages`, body);
      return { externalMessageId: result.data?.messages?.[0]?.id ?? `meta_${Date.now()}`, status: 'sent' };
    }

    const result = await this.post(`${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: true, body: text },
    });
    return { externalMessageId: result.data?.messages?.[0]?.id ?? `meta_${Date.now()}`, status: 'sent' };
  }

  async sendTemplate(to: string, templateName: string, language: string, bodyVariables?: string[]): Promise<OutboundMessageResult> {
    this.assertConfigured();
    const result = await this.post(`${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components: bodyVariables?.length
          ? [{ type: 'body', parameters: bodyVariables.map((v) => ({ type: 'text', text: v })) }]
          : undefined,
      },
    });
    return { externalMessageId: result.data?.messages?.[0]?.id ?? `meta_${Date.now()}`, status: 'sent' };
  }

  async markAsRead(messageId: string): Promise<void> {
    this.assertConfigured();
    await this.post(`${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
  }

  parseWebhook(payload: unknown): {
    messages: Array<{
      externalMessageId: string;
      from: string;
      to: string;
      type: string;
      body?: string;
      mediaUrl?: string;
      mimeType?: string;
      timestamp?: number;
      context?: { from?: string; id?: string };
      metadata?: Record<string, unknown>;
    }>;
    statuses: Array<{ externalMessageId: string; status: MessageStatus; timestamp?: number }>;
    errors: Array<{ message: string }>;
  } {
    const p = payload as any;
    const entries = p?.entry ?? [];
    const messages: Array<{
      externalMessageId: string;
      from: string;
      to: string;
      type: string;
      body?: string;
      mediaUrl?: string;
      mimeType?: string;
      timestamp?: number;
      context?: { from?: string; id?: string };
      metadata?: Record<string, unknown>;
    }> = [];
    const statuses: Array<{ externalMessageId: string; status: MessageStatus; timestamp?: number }> = [];
    const errors: Array<{ message: string }> = [];

    for (const entry of entries) {
      const changes = entry?.changes ?? [];
      for (const change of changes) {
        const value = change?.value ?? {};
        const msgs = value?.messages ?? [];
        for (const m of msgs) {
          const type = m?.type ?? 'text';
          let body: string | undefined;
          let mediaUrl: string | undefined;
          let mimeType: string | undefined;
          if (type === 'text') body = m?.text?.body;
          else if (type === 'image') {
            body = m?.image?.caption;
            mediaUrl = m?.image?.id ? `media:${m.image.id}` : undefined;
            mimeType = m?.image?.mime_type;
          } else if (type === 'document') {
            body = m?.document?.caption;
            mediaUrl = m?.document?.id ? `media:${m.document.id}` : undefined;
            mimeType = m?.document?.mime_type;
          } else if (type === 'video') {
            mediaUrl = m?.video?.id ? `media:${m.video.id}` : undefined;
            mimeType = m?.video?.mime_type;
          } else if (type === 'audio') {
            mediaUrl = m?.audio?.id ? `media:${m.audio.id}` : undefined;
            mimeType = m?.audio?.mime_type;
          } else if (type === 'location') {
            body = `📍 ${m?.location?.name ?? ''}\n${m?.location?.latitude ?? ''}, ${m?.location?.longitude ?? ''}`;
          } else if (type === 'contacts') {
            const c = m?.contacts?.[0];
            body = `👤 ${c?.name?.formatted_name ?? 'Contact'}\n${c?.phones?.map((p: any) => p.phone).join(', ') ?? ''}`;
          }

          messages.push({
            externalMessageId: m?.id ?? `meta_${Date.now()}_${Math.random()}`,
            from: m?.from ?? '',
            to: value?.metadata?.phone_number_id ?? '',
            type,
            body,
            mediaUrl,
            mimeType,
            timestamp: m?.timestamp ? Number(m.timestamp) * 1000 : undefined,
            context: m?.context ? { from: m.context.from, id: m.context.id } : undefined,
          });
        }

        const status = value?.statuses ?? [];
        for (const s of status) {
          const st = (s?.status ?? '').toLowerCase();
          if (st === 'sent' || st === 'delivered' || st === 'read' || st === 'failed') {
            statuses.push({ externalMessageId: s?.id, status: st as MessageStatus, timestamp: s?.timestamp ? Number(s.timestamp) * 1000 : undefined });
          }
        }

        if (value?.errors?.length) {
          for (const e of value.errors) errors.push({ message: e?.message ?? 'WhatsApp error' });
        }
      }
    }
    return { messages, statuses, errors };
  }

  verifyWebhook(mode: string | undefined, token: string | undefined, challenge: string | undefined): string | null {
    if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
      return challenge ?? null;
    }
    return null;
  }
}

export function getProvider(): WhatsAppProvider {
  const configured = config.whatsapp.accessToken && config.whatsapp.phoneNumberId;
  if (configured) return new MetaWhatsAppProvider();
  return new DemoWhatsAppProvider();
}