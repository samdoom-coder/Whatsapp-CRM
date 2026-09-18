// WhatsApp provider abstraction. All concrete providers implement this interface.
// Business logic never depends on a specific provider implementation.

export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

export interface SendMessageOptions {
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document' | 'sticker';
  fileName?: string;
  caption?: string;
  templateName?: string;
  templateLanguage?: string;
  templateBodyVariables?: string[];
  buttons?: Array<{ id: string; title: string }>;
}

export interface OutboundMessageResult {
  externalMessageId: string;
  status: MessageStatus;
}

export interface InboundWebhookMessage {
  externalMessageId: string;
  from: string; // customer phone
  to: string; // business number id
  type: string; // text | image | video | audio | document | location | contacts | ...
  body?: string;
  mediaUrl?: string;
  mimeType?: string;
  timestamp?: number;
  context?: { from?: string; id?: string };
  metadata?: Record<string, unknown>;
}

export interface WhatsAppProvider {
  readonly name: string;
  readonly isDemo: boolean;

  /** Send a plain text message. Returns provider message id. */
  sendMessage(to: string, text: string, options?: SendMessageOptions): Promise<OutboundMessageResult>;

  /** Send an approved template message. */
  sendTemplate(to: string, templateName: string, language: string, bodyVariables?: string[]): Promise<OutboundMessageResult>;

  /** Mark an inbound message as read on the provider. */
  markAsRead(messageId: string): Promise<void>;

  /** Resolve the provider webhook payload into a normalized inbound event. */
  parseWebhook(payload: unknown): {
    messages: InboundWebhookMessage[];
    statuses: Array<{ externalMessageId: string; status: MessageStatus; timestamp?: number }>;
    errors: Array<{ message: string }>;
  };

  /** Verify webhook signature for hub verify handshake. */
  verifyWebhook(mode: string | undefined, token: string | undefined, challenge: string | undefined): string | null;
}