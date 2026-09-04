/**
 * Integration tests — auth flows.
 *
 * These tests validate the auth.service helpers and the Zod schemas
 * without requiring a running server or database.
 */

import { describe, expect, it } from 'vitest';

// ─── Auth Service Unit Tests ────────────────────────────────────
describe('Auth Service', () => {
  it('generateOTP returns a 6-digit string', async () => {
    const { generateOTP } = await import('../src/services/auth.service.js');
    const otp = generateOTP();
    expect(otp).toMatch(/^\d{6}$/);
    expect(otp.length).toBe(6);
  });

  it('generateOTP produces unique values', async () => {
    const { generateOTP } = await import('../src/services/auth.service.js');
    const otps = new Set(Array.from({ length: 50 }, () => generateOTP()));
    // With 50 random 6-digit numbers the probability of all being the same is negligible
    expect(otps.size).toBeGreaterThan(1);
  });

  it('hashOTP produces consistent SHA-256 hashes', async () => {
    const { hashOTP } = await import('../src/services/auth.service.js');
    const hash1 = hashOTP('123456');
    const hash2 = hashOTP('123456');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 = 64 hex chars
  });

  it('hashOTP produces different hashes for different inputs', async () => {
    const { hashOTP } = await import('../src/services/auth.service.js');
    expect(hashOTP('123456')).not.toBe(hashOTP('654321'));
  });
});

// ─── Zod Schema Tests ───────────────────────────────────────────
describe('Auth Schemas', () => {
  describe('registerSchema', () => {
    it('accepts valid registration data', async () => {
      const { registerSchema } = await import('../src/schemas/auth.schema.js');
      const result = registerSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing password', async () => {
      const { registerSchema } = await import('../src/schemas/auth.schema.js');
      const result = registerSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      });
      expect(result.success).toBe(false);
    });

    it('rejects short password', async () => {
      const { registerSchema } = await import('../src/schemas/auth.schema.js');
      const result = registerSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: '123',
      });
      expect(result.success).toBe(false);
    });

    it('requires at least email or phone', async () => {
      const { registerSchema } = await import('../src/schemas/auth.schema.js');
      const result = registerSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('accepts phone without email', async () => {
      const { registerSchema } = await import('../src/schemas/auth.schema.js');
      const result = registerSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        password: 'password123',
      });
      expect(result.success).toBe(true);
    });

    it('validates gender enum', async () => {
      const { registerSchema } = await import('../src/schemas/auth.schema.js');
      const result = registerSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        email: 'j@x.com',
        password: 'password123',
        gender: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('accepts email + password', async () => {
      const { loginSchema } = await import('../src/schemas/auth.schema.js');
      const result = loginSchema.safeParse({
        email: 'john@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty password', async () => {
      const { loginSchema } = await import('../src/schemas/auth.schema.js');
      const result = loginSchema.safeParse({
        email: 'john@example.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('changePasswordSchema', () => {
    it('validates minimum password length', async () => {
      const { changePasswordSchema } = await import('../src/schemas/auth.schema.js');
      const result = changePasswordSchema.safeParse({
        currentPassword: 'oldpass123',
        newPassword: 'short',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Post Schemas', () => {
  describe('uploadPostSchema', () => {
    it('accepts valid post data', async () => {
      const { uploadPostSchema } = await import('../src/schemas/post.schema.js');
      const result = uploadPostSchema.safeParse({
        caption: 'Hello world',
        visibility: 'public',
      });
      expect(result.success).toBe(true);
    });

    it('rejects caption over 2000 chars', async () => {
      const { uploadPostSchema } = await import('../src/schemas/post.schema.js');
      const result = uploadPostSchema.safeParse({
        caption: 'x'.repeat(2001),
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid visibility', async () => {
      const { uploadPostSchema } = await import('../src/schemas/post.schema.js');
      const result = uploadPostSchema.safeParse({
        visibility: 'secret',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('commentSchema', () => {
    it('rejects empty comment', async () => {
      const { commentSchema } = await import('../src/schemas/post.schema.js');
      const result = commentSchema.safeParse({ text: '' });
      expect(result.success).toBe(false);
    });

    it('accepts valid comment', async () => {
      const { commentSchema } = await import('../src/schemas/post.schema.js');
      const result = commentSchema.safeParse({ text: 'Nice post!' });
      expect(result.success).toBe(true);
    });
  });

  describe('reportSchema', () => {
    it('rejects empty reason', async () => {
      const { reportSchema } = await import('../src/schemas/post.schema.js');
      const result = reportSchema.safeParse({ reason: '' });
      expect(result.success).toBe(false);
    });
  });
});

describe('Chat Schemas', () => {
  describe('editMessageSchema', () => {
    it('rejects empty text', async () => {
      const { editMessageSchema } = await import('../src/schemas/chat.schema.js');
      const result = editMessageSchema.safeParse({ text: '' });
      expect(result.success).toBe(false);
    });

    it('rejects text over 5000 chars', async () => {
      const { editMessageSchema } = await import('../src/schemas/chat.schema.js');
      const result = editMessageSchema.safeParse({ text: 'x'.repeat(5001) });
      expect(result.success).toBe(false);
    });
  });
});

// ─── Validate Middleware Tests ───────────────────────────────────
describe('Validate Middleware', () => {
  describe('validateBody', () => {
    it('passes parsed body to next on valid data', async () => {
      const { validateBody } = await import('../src/middleware/validate.js');
      const { loginSchema } = await import('../src/schemas/auth.schema.js');

      const middleware = validateBody(loginSchema);
      const req = { body: { email: 'test@test.com', password: 'pass1234' } };
      const res = {};
      const next = vi.fn();

      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith(); // called with no error
    });

    it('calls next with ApiError on invalid data', async () => {
      const { validateBody } = await import('../src/middleware/validate.js');
      const { loginSchema } = await import('../src/schemas/auth.schema.js');

      const middleware = validateBody(loginSchema);
      const req = { body: { email: 'test@test.com' } }; // missing password
      const res = {};
      const next = vi.fn();

      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });
  });

  describe('validateObjectId', () => {
    it('passes for valid ObjectId', async () => {
      const { validateObjectId } = await import('../src/middleware/validate.js');

      const middleware = validateObjectId('userId');
      const req = { params: { userId: '507f1f77bcf86cd799439011' } };
      const next = vi.fn();

      middleware(req, {}, next);
      expect(next).toHaveBeenCalledWith(); // no error
    });

    it('rejects invalid ObjectId', async () => {
      const { validateObjectId } = await import('../src/middleware/validate.js');

      const middleware = validateObjectId('userId');
      const req = { params: { userId: 'not-an-id' } };
      const next = vi.fn();

      middleware(req, {}, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });
  });
});
