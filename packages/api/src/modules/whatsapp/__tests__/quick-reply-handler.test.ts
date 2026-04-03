import { describe, it, expect } from 'vitest';
import { parseQuickReplyEvent } from '../quick-reply-handler.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const buttonReplyPayload = {
  messages: [
    {
      from: '263771234567',
      id: 'wamid.abc123',
      timestamp: '1234567890',
      type: 'interactive',
      interactive: {
        type: 'button_reply',
        button_reply: {
          id: 'view-details-prod-1',
          title: 'View Details',
        },
      },
    },
  ],
};

const listReplyPayload = {
  messages: [
    {
      from: '263771234567',
      id: 'wamid.abc123',
      timestamp: '1234567890',
      type: 'interactive',
      interactive: {
        type: 'list_reply',
        list_reply: {
          id: 'prod-1',
          title: 'Product 1',
        },
      },
    },
  ],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('parseQuickReplyEvent', () => {
  it('parses a button_reply interactive event', () => {
    const result = parseQuickReplyEvent(buttonReplyPayload);

    expect(result).not.toBeNull();
    expect(result?.type).toBe('button_reply');
    expect(result?.from).toBe('263771234567');
    expect(result?.messageId).toBe('wamid.abc123');
    expect(result?.buttonId).toBe('view-details-prod-1');
    expect(result?.buttonTitle).toBe('View Details');
    expect(result?.timestamp).toBe(1234567890);
  });

  it('parses a list_reply interactive event (carousel selection)', () => {
    const result = parseQuickReplyEvent(listReplyPayload);

    expect(result).not.toBeNull();
    expect(result?.type).toBe('list_reply');
    expect(result?.from).toBe('263771234567');
    expect(result?.messageId).toBe('wamid.abc123');
    expect(result?.buttonId).toBe('prod-1');
    expect(result?.buttonTitle).toBe('Product 1');
    expect(result?.timestamp).toBe(1234567890);
  });

  it('returns null for a plain text message', () => {
    const payload = {
      messages: [
        {
          from: '263771234567',
          id: 'wamid.text1',
          timestamp: '1234567890',
          type: 'text',
          text: { body: 'Hello' },
        },
      ],
    };

    expect(parseQuickReplyEvent(payload)).toBeNull();
  });

  it('returns null for an image message', () => {
    const payload = {
      messages: [
        {
          from: '263771234567',
          id: 'wamid.img1',
          timestamp: '1234567890',
          type: 'image',
          image: { id: 'img-id-1' },
        },
      ],
    };

    expect(parseQuickReplyEvent(payload)).toBeNull();
  });

  it('returns null for an interactive message that is not button_reply or list_reply', () => {
    const payload = {
      messages: [
        {
          from: '263771234567',
          id: 'wamid.flow1',
          timestamp: '1234567890',
          type: 'interactive',
          interactive: {
            type: 'nfm_reply', // unsupported interactive subtype
            nfm_reply: { response_json: '{}', body: 'Sent', name: 'flow' },
          },
        },
      ],
    };

    expect(parseQuickReplyEvent(payload)).toBeNull();
  });

  it('returns null when messages array is empty', () => {
    expect(parseQuickReplyEvent({ messages: [] })).toBeNull();
  });

  it('returns null when messages key is absent', () => {
    expect(parseQuickReplyEvent({})).toBeNull();
  });

  it('extracts all required fields correctly from button_reply', () => {
    const result = parseQuickReplyEvent(buttonReplyPayload);

    // All five required fields must be present and non-null
    expect(result).toMatchObject({
      type: 'button_reply',
      from: expect.any(String),
      messageId: expect.any(String),
      buttonId: expect.any(String),
      buttonTitle: expect.any(String),
      timestamp: expect.any(Number),
    });
  });
});
