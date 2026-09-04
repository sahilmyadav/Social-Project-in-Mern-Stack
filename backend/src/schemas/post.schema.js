import { z } from 'zod';

// ─── Upload Post ─────────────────────────────────────────────────
export const uploadPostSchema = z.object({
  caption: z.string().max(2000, 'Caption must be at most 2000 characters').optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  location: z
    .union([z.string(), z.object({ name: z.string().optional() }).passthrough()])
    .optional(),
  visibility: z.enum(['public', 'private', 'followers']).default('public'),
});

// ─── Comment ─────────────────────────────────────────────────────
export const commentSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Comment text is required')
    .max(1000, 'Comment must be at most 1000 characters'),
  reply_to_comment_id: z.string().optional(),
  media: z.any().optional(),
});

// ─── Report ──────────────────────────────────────────────────────
export const reportSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Reason is required')
    .max(500, 'Reason must be at most 500 characters'),
});
