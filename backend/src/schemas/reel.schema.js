import { z } from 'zod';

// ─── Upload Reel ─────────────────────────────────────────────────
export const uploadReelSchema = z.object({
  caption: z.string().max(2000, 'Caption must be at most 2000 characters').optional(),
  music_id: z.string().optional().nullable(),
  music: z.union([z.string(), z.object({}).passthrough()]).optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  thumbnail: z.string().optional(),
  duration: z.union([z.number(), z.string()]).optional().nullable(),
  width: z.union([z.number(), z.string()]).optional().nullable(),
  height: z.union([z.number(), z.string()]).optional().nullable(),
});

// ─── Comment on Reel ─────────────────────────────────────────────
export const reelCommentSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Comment text is required')
    .max(1000, 'Comment must be at most 1000 characters'),
  reply_to_comment_id: z.string().optional(),
});

// ─── Report Reel ─────────────────────────────────────────────────
export const reportReelSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Reason is required')
    .max(500, 'Reason must be at most 500 characters'),
});
