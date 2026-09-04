/**
 * PR4 Structure Tests
 *
 * Validates structural improvements:
 * - Validators middleware
 * - Enrichment service
 * - Constants extensions
 */

import { describe, expect, it, vi } from 'vitest';

// ─── Validators ─────────────────────────────────────────────────
describe('validate middleware', () => {
  let validatePagination, validateObjectId, requireFields, validateLength;

  beforeAll(async () => {
    const mod = await import('../src/middleware/validate.js');
    validatePagination = mod.validatePagination;
    validateObjectId = mod.validateObjectId;
    requireFields = mod.requireFields;
    validateLength = mod.validateLength;
  });

  describe('validatePagination', () => {
    it('parses page and limit from query', () => {
      const req = { query: { page: '2', limit: '15' } };
      const next = vi.fn();
      validatePagination(req, {}, next);
      expect(req.pagination).toEqual({ page: 2, limit: 15, skip: 15 });
      expect(next).toHaveBeenCalled();
    });

    it('defaults to page 1 / limit 20 when missing', () => {
      const req = { query: {} };
      const next = vi.fn();
      validatePagination(req, {}, next);
      expect(req.pagination.page).toBe(1);
      expect(req.pagination.limit).toBe(20);
      expect(req.pagination.skip).toBe(0);
    });

    it('caps limit at MAX_LIMIT', () => {
      const req = { query: { limit: '9999' } };
      const next = vi.fn();
      validatePagination(req, {}, next);
      expect(req.pagination.limit).toBeLessThanOrEqual(100);
    });
  });

  describe('validateObjectId', () => {
    it('calls next for valid ObjectIds', () => {
      const req = { params: { postId: '507f1f77bcf86cd799439011' } };
      const next = vi.fn();
      validateObjectId('postId')(req, {}, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('calls next with ApiError for invalid ObjectIds', () => {
      const req = { params: { postId: 'not-an-id' } };
      const next = vi.fn();
      validateObjectId('postId')(req, {}, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });
  });

  describe('requireFields', () => {
    it('passes when all fields present', () => {
      const req = { body: { name: 'test', email: 'a@b.com' } };
      const next = vi.fn();
      requireFields('name', 'email')(req, {}, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('errors when field is missing', () => {
      const req = { body: { name: 'test' } };
      const next = vi.fn();
      requireFields('name', 'email')(req, {}, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });
  });

  describe('validateLength', () => {
    it('trims and passes short values', () => {
      const req = { body: { caption: '  hello  ' } };
      const next = vi.fn();
      validateLength({ field: 'caption', max: 100 })(req, {}, next);
      expect(req.body.caption).toBe('hello');
      expect(next).toHaveBeenCalledWith();
    });

    it('rejects over-length values', () => {
      const req = { body: { caption: 'a'.repeat(201) } };
      const next = vi.fn();
      validateLength({ field: 'caption', max: 200 })(req, {}, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });
  });
});

// ─── Enrichment Service ─────────────────────────────────────────
describe('enrichment service exports', () => {
  it('exports all expected batch functions', async () => {
    const mod = await import('../src/services/enrichment.service.js');
    expect(typeof mod.getLikedIds).toBe('function');
    expect(typeof mod.getSavedIds).toBe('function');
    expect(typeof mod.getLikeCounts).toBe('function');
    expect(typeof mod.getCommentCounts).toBe('function');
    expect(typeof mod.getFollowStatusMap).toBe('function');
    expect(typeof mod.getFollowerCounts).toBe('function');
  });
});

// ─── Extended Constants ─────────────────────────────────────────
describe('config/constants', () => {
  it('exports SEARCH and REDIS_KEYS alongside existing groups', async () => {
    const c = await import('../src/config/constants.js');
    expect(c.SEARCH).toBeDefined();
    expect(c.SEARCH.MAX_QUERY_LENGTH).toBe(200);
    expect(c.REDIS_KEYS).toBeDefined();
    expect(c.REDIS_KEYS.ONLINE_USER).toBe('online:');
  });
});
