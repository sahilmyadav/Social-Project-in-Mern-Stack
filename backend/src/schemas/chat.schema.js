import { z } from 'zod';

// ─── Send Message ────────────────────────────────────────────────
export const sendMessageSchema = z
  .object({
    text: z.string().max(5000, 'Message must be at most 5000 characters').optional(),
    media_ids: z.array(z.string()).optional().default([]),
    reply_to: z.string().optional(),
    messageType: z
      .enum(['text', 'image', 'video', 'audio', 'file', 'location', 'shared'])
      .default('text'),
    sharedContent: z.any().optional(),
    isForwarded: z.boolean().default(false),
    location: z.any().optional(),
  })
  .refine(
    (data) =>
      (data.text && data.text.trim().length > 0) ||
      data.media_ids.length > 0 ||
      data.sharedContent ||
      data.location,
    { message: 'Message must have text, media, shared content, or location' }
  );

// ─── Edit Message ────────────────────────────────────────────────
export const editMessageSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Message text is required')
    .max(5000, 'Message must be at most 5000 characters'),
});
