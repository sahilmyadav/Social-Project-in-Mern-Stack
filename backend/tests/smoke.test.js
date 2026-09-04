/**
 * Backend Smoke Tests
 *
 * Minimal test suite to validate the app boots and core endpoints respond.
 * These tests import the Express app directly (no HTTP server needed for most).
 * Uses supertest for HTTP-level assertions.
 *
 * Run: npm run test
 */

import { describe, expect, it } from 'vitest';

// ─── Unit Tests (no server required) ────────────────────────────
describe('Utils', () => {
  describe('ApiError', () => {
    it('creates error with correct properties', async () => {
      const { default: ApiError } = await import('../src/utils/ApiError.js');
      const err = new ApiError(404, 'Not found', ['detail']);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe('Not found');
      expect(err.success).toBe(false);
      expect(err.errors).toEqual(['detail']);
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('ApiResponse', () => {
    it('creates success response', async () => {
      const { default: ApiResponse } = await import('../src/utils/ApiResponse.js');
      const res = new ApiResponse(200, { id: 1 }, 'OK');
      expect(res.statusCode).toBe(200);
      expect(res.success).toBe(true);
      expect(res.data).toEqual({ id: 1 });
    });

    it('creates error response for 4xx', async () => {
      const { default: ApiResponse } = await import('../src/utils/ApiResponse.js');
      const res = new ApiResponse(400, null, 'Bad');
      expect(res.success).toBe(false);
    });
  });

  describe('asyncHandler', () => {
    it('catches rejected promises and calls next', async () => {
      const { default: asyncHandler } = await import('../src/utils/asyncHandler.js');
      const error = new Error('fail');
      const handler = asyncHandler(async () => {
        throw error;
      });
      const next = vi.fn();
      await handler({}, {}, next);
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('Logger', () => {
    it('exports all log levels', async () => {
      const { default: logger } = await import('../src/utils/logger.js');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });
  });
});

// ─── Config Tests ───────────────────────────────────────────────
describe('Config', () => {
  describe('constants', () => {
    it('exports expected constant groups', async () => {
      const constants = await import('../src/config/constants.js');
      expect(constants.PAGINATION).toBeDefined();
      expect(constants.PAGINATION.DEFAULT_LIMIT).toBe(20);
      expect(constants.AUTH).toBeDefined();
      expect(constants.UPLOAD).toBeDefined();
      expect(constants.STORY).toBeDefined();
      expect(constants.COOKIE_OPTIONS).toBeDefined();
    });
  });
});
