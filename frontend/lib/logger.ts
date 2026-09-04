/**
 * Application logger — gates console output behind NODE_ENV.
 * In production, replace with a real logging service (Sentry, Datadog, etc.).
 * In development, passes through to console.
 */

const isDev = process.env.NODE_ENV !== 'production';

const noop = (..._args: unknown[]) => {};

const logger = {
  debug: isDev ? console.debug.bind(console) : noop,
  info: isDev ? console.info.bind(console) : noop,
  warn: isDev ? console.warn.bind(console) : noop,
  error: console.error.bind(console), // always log errors
  log: isDev ? console.log.bind(console) : noop,
};

export default logger;
