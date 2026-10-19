export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigins: string[];
  webhookSecret: string;
  demoUsers: boolean;
  rateLimitMax: number;
  rateLimitWindowMs: number;
  bodyLimitBytes: number;
  sessionTtlMs: number;
  paymentProviderName: string;
}

export const DEFAULT_WEBHOOK_SECRET = 'dev-only-change-this-webhook-secret';

function integer(value: string | undefined, fallback: number, minimum: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed >= minimum ? parsed : fallback;
}

function boolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const defaultOrigins = nodeEnv === 'production'
    ? ''
    : 'http://localhost:4173,http://127.0.0.1:4173,http://localhost:3000,http://127.0.0.1:3000';
  const origins = (env.PAYLINK_CORS_ORIGINS ?? defaultOrigins)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const webhookSecret = env.PAYLINK_WEBHOOK_SECRET ?? DEFAULT_WEBHOOK_SECRET;
  if (nodeEnv === 'production' && (!webhookSecret || webhookSecret === DEFAULT_WEBHOOK_SECRET)) {
    throw new Error('PAYLINK_WEBHOOK_SECRET must be set to a non-default value in production');
  }

  const defaultRateLimitMax = nodeEnv === 'production' ? 120 : 1_000;

  return {
    nodeEnv,
    port: integer(env.PORT, 4000, 1),
    corsOrigins: origins,
    webhookSecret,
    demoUsers: boolean(env.PAYLINK_DEMO_USERS, nodeEnv !== 'production'),
    rateLimitMax: integer(env.PAYLINK_RATE_LIMIT_MAX, defaultRateLimitMax, 1),
    rateLimitWindowMs: integer(env.PAYLINK_RATE_LIMIT_WINDOW_MS, 60_000, 1_000),
    bodyLimitBytes: integer(env.PAYLINK_BODY_LIMIT_BYTES, 1_000_000, 1_024),
    sessionTtlMs: 24 * 60 * 60 * 1_000,
    paymentProviderName: 'dev-test-provider',
  };
}
