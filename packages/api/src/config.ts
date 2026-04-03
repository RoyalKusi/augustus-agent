import 'dotenv/config';

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  env: optional('NODE_ENV', 'development'),
  port: Number(optional('PORT', '3000')),

  db: {
    host: optional('DB_HOST', 'localhost'),
    port: Number(optional('DB_PORT', '5432')),
    name: optional('DB_NAME', 'augustus'),
    user: optional('DB_USER', 'postgres'),
    password: optional('DB_PASSWORD', ''),
    ssl: process.env.DB_SSL === 'true',
    poolMax: Number(optional('DB_POOL_MAX', '20')),
  },

  redis: {
    url: process.env.REDIS_URL,
    host: optional('REDIS_HOST', '127.0.0.1'),
    port: Number(optional('REDIS_PORT', '6379')),
    password: process.env.REDIS_PASSWORD,
  },

  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: optional('S3_REGION', 'us-east-1'),
    accessKeyId: optional('S3_ACCESS_KEY_ID', ''),
    secretAccessKey: optional('S3_SECRET_ACCESS_KEY', ''),
    bucket: optional('S3_BUCKET', 'augustus'),
  },

  claude: {
    apiKey: process.env.CLAUDE_API_KEY ?? '',
    model: optional('CLAUDE_MODEL', 'claude-haiku-20240307'),
  },

  meta: {
    appId: process.env.META_APP_ID ?? '',
    appSecret: process.env.META_APP_SECRET ?? '',
    verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN ?? '',
    graphApiVersion: optional('META_GRAPH_API_VERSION', 'v19.0'),
    embeddedSignupConfigId: process.env.META_EMBEDDED_SIGNUP_CONFIG_ID ?? '',
  },

  paynow: {
    integrationId: process.env.PAYNOW_INTEGRATION_ID ?? '',
    integrationKey: process.env.PAYNOW_INTEGRATION_KEY ?? '',
    returnUrl: optional('PAYNOW_RETURN_URL', 'https://example.com/payment/return'),
    resultUrl: optional('PAYNOW_RESULT_URL', 'https://example.com/payment/result'),
  },

  email: {
    provider: optional('EMAIL_PROVIDER', 'sendgrid'), // 'sendgrid' | 'ses'
    apiKey: process.env.EMAIL_API_KEY ?? '',
    fromAddress: optional('EMAIL_FROM_ADDRESS', 'noreply@augustus.ai'),
    fromName: optional('EMAIL_FROM_NAME', 'Augustus'),
  },

  jwt: {
    secret: optional('JWT_SECRET', 'change-me-in-production'),
    expiresIn: optional('JWT_EXPIRES_IN', '24h'),
  },

  withdrawal: {
    autoProcessThreshold: Number(optional('WITHDRAWAL_AUTO_PROCESS_THRESHOLD', '50')),
  },

  baseUrl: optional('BASE_URL', 'http://localhost:3000'),

  frontendUrl: optional('FRONTEND_URL', 'http://localhost:5173'),

  encryption: {
    // 32-byte key expressed as a 64-character hex string
    key: optional('ENCRYPTION_KEY', ''),
  },
} as const;
