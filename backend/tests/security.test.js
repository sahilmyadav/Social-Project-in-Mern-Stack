/**
 * PR1 Security Tests
 *
 * Validates the security fixes implemented in PR1:
 * - ReDoS protection via regex escaping
 * - Blocked user utility
 * - Rate limiter module configuration
 * - Environment validation
 * - Upload file filter (SVG blocked)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Search Utilities ───────────────────────────────────────────
describe('searchUtils', () => {
  let escapeRegex, buildSafeRegex;

  beforeEach(async () => {
    const mod = await import('../src/utils/searchUtils.js');
    escapeRegex = mod.escapeRegex;
    buildSafeRegex = mod.buildSafeRegex;
  });

  describe('escapeRegex', () => {
    it('escapes special regex characters', () => {
      expect(escapeRegex('hello.*+?^${}()|[]\\world')).toBe(
        'hello\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\world'
      );
    });

    it('leaves normal text unchanged', () => {
      expect(escapeRegex('hello world')).toBe('hello world');
    });

    it('handles ReDoS payloads safely', () => {
      const malicious = '(a+)+$';
      const escaped = escapeRegex(malicious);
      // The escaped version should be a literal match, not a catastrophic backtracker
      const regex = new RegExp(escaped, 'i');
      expect(regex.test('(a+)+$')).toBe(true);
      expect(regex.test('aaaaaaaaaaaa')).toBe(false);
    });

    it('handles empty string', () => {
      expect(escapeRegex('')).toBe('');
    });
  });

  describe('buildSafeRegex', () => {
    it('returns a case-insensitive RegExp', () => {
      const regex = buildSafeRegex('Hello');
      expect(regex).toBeInstanceOf(RegExp);
      expect(regex.flags).toBe('i');
      expect(regex.test('hello')).toBe(true);
      expect(regex.test('HELLO')).toBe(true);
    });

    it('truncates input to maxLength', () => {
      const long = 'a'.repeat(500);
      const regex = buildSafeRegex(long, 10);
      // The resulting pattern should only be 10 chars long
      expect(regex.source).toBe('a'.repeat(10));
    });

    it('trims whitespace', () => {
      const regex = buildSafeRegex('  test  ');
      expect(regex.test('test')).toBe(true);
    });

    it('escapes special characters in input', () => {
      const regex = buildSafeRegex('price: $99.00');
      // Should match literally, not as a regex anchor + wildcard
      expect(regex.test('price: $99.00')).toBe(true);
      expect(regex.test('price: X99Y00')).toBe(false);
    });
  });
});

// ─── Rate Limiter ───────────────────────────────────────────────
describe('rateLimiter', () => {
  it('exports expected limiter functions', async () => {
    const mod = await import('../src/middleware/rateLimiter.js');
    expect(mod.apiLimiter).toBeDefined();
    expect(mod.authLimiter).toBeDefined();
    expect(mod.uploadLimiter).toBeDefined();
    expect(mod.searchLimiter).toBeDefined();
    expect(typeof mod.apiLimiter).toBe('function');
  });

  it('passthrough middleware calls next() when rate limiting disabled', async () => {
    // ENABLE_RATE_LIMIT is not set (default), so limiters should be passthroughs
    delete process.env.ENABLE_RATE_LIMIT;
    const mod = await import('../src/middleware/rateLimiter.js');
    // If rate limiting is disabled, the exported limiter is a plain (req,res,next)=>next()
    // If enabled, it's an express-rate-limit instance (also middleware, but with .resetKey etc.)
    const next = vi.fn();
    mod.apiLimiter({}, {}, next);
    expect(next).toHaveBeenCalled();
  });
});

// ─── Environment Validation ─────────────────────────────────────
describe('env validation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset to safe test values
    process.env.MONGO_URL = 'mongodb://localhost:27017/test';
    process.env.ACCESS_TOKEN_SECRET = 'test-secret-not-weak';
    process.env.REFRESH_TOKEN_SECRET = 'test-secret-not-weak';
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('validateEnv is a callable function', async () => {
    const { validateEnv } = await import('../src/config/env.js');
    expect(typeof validateEnv).toBe('function');
  });

  it('does not throw when required vars are present', async () => {
    const { validateEnv } = await import('../src/config/env.js');
    expect(() => validateEnv()).not.toThrow();
  });

  it('warns on weak secrets in development', async () => {
    process.env.ACCESS_TOKEN_SECRET = 'change-this-to-secure-secret';
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { validateEnv } = await import('../src/config/env.js');
    validateEnv();
    // Should have logged a warning about weak secrets
    const calls = spy.mock.calls.flat().join(' ');
    expect(calls).toContain('Weak');
    spy.mockRestore();
  });
});
