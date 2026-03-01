import { loadEnv, Modules, defineConfig } from '@medusajs/utils';
import {
  ADMIN_CORS,
  AUTH_CORS,
  BACKEND_URL,
  COOKIE_SECRET,
  DATABASE_URL,
  JWT_SECRET,
  REDIS_URL,
  RESEND_API_KEY,
  RESEND_FROM_EMAIL,
  SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL,
  SHOULD_DISABLE_ADMIN,
  STORE_CORS,
  STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY,
  STRIPE_WEBHOOK_SECRET,
  STRIPE_TEST_MODE,
  MOLLIE_API_KEY,
  MOLLIE_TEST_MODE,
  WORKER_MODE,
  MINIO_ENDPOINT,
  MINIO_ACCESS_KEY,
  MINIO_SECRET_KEY,
  MINIO_BUCKET,
  MEILISEARCH_HOST,
  MEILISEARCH_ADMIN_KEY,
  KLARNA_API_KEY,
  KLARNA_SECRET_KEY,
  KLARNA_TEST_MODE,
  PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET,
  PAYPAL_MODE,
  PAYPAL_CLIENT_ID_EC,
  PAYPAL_CLIENT_SECRET_EC,
  PAYPAL_MODE_EC,
  AIRWALLEX_CLIENT_ID,
  AIRWALLEX_API_KEY,
  AIRWALLEX_ACCOUNT_ID,
  AIRWALLEX_TEST_MODE,
} from 'lib/constants';

loadEnv(process.env.NODE_ENV, process.cwd());

const medusaConfig = {
  projectConfig: {
    databaseUrl: DATABASE_URL,
    databaseLogging: false,
    redisUrl: REDIS_URL,
    workerMode: WORKER_MODE,
    http: {
      adminCors: ADMIN_CORS,
      authCors: AUTH_CORS,
      storeCors: STORE_CORS,
      jwtSecret: JWT_SECRET,
      cookieSecret: COOKIE_SECRET
    },
    build: {
      rollupOptions: {
        external: [
          "@medusajs/dashboard",
          "@medusajs/admin-shared",
          "@medusajs/icons",
          "@medusajs/ui",
          "@medusajs/js-sdk",
          "@tanstack/react-query",
          "react-router-dom"
        ]
      }
    }
  },
  admin: {
    backendUrl: BACKEND_URL,
    disable: SHOULD_DISABLE_ADMIN,
  },
  modules: [
    // ═══ Custom modules ═══
    { resolve: "./src/modules/billing-entity" },
    { resolve: "./src/modules/gateway-config" },
    { resolve: "./src/modules/meta-pixel" },
    { resolve: "./src/modules/analytics" },
    { resolve: "./src/modules/fakturoid" },
    { resolve: "./src/modules/quickbooks" },
    { resolve: "./src/modules/dextrum" },
    { resolve: "./src/modules/supportbox" },
    { resolve: "./src/modules/project-settings" },
    { resolve: "./src/modules/resend-config" },
    { resolve: "./src/modules/digital-download" },
    // ═══ Payment provider modules (non-Medusa-payment, standalone) ═══
    { resolve: "./src/modules/payment-comgate" },
    { resolve: "./src/modules/payment-przelewy24" },
    // NOTE: payment-klarna & payment-airwallex are registered as proper payment providers below
    // ═══ Core modules ═══
    {
      key: Modules.FILE,
      resolve: '@medusajs/file',
      options: {
        providers: [
          ...(MINIO_ENDPOINT && MINIO_ACCESS_KEY && MINIO_SECRET_KEY ? [{
            resolve: './src/modules/minio-file',
            id: 'minio',
            options: {
              endPoint: MINIO_ENDPOINT,
              accessKey: MINIO_ACCESS_KEY,
              secretKey: MINIO_SECRET_KEY,
              bucket: MINIO_BUCKET // Optional, default: medusa-media
            }
          }] : [{
            resolve: '@medusajs/file-local',
            id: 'local',
            options: {
              upload_dir: 'static',
              backend_url: `${BACKEND_URL}/static`
            }
          }])
        ]
      }
    },
    ...(REDIS_URL ? [{
      key: Modules.EVENT_BUS,
      resolve: '@medusajs/event-bus-redis',
      options: {
        redisUrl: REDIS_URL
      }
    },
    {
      key: Modules.WORKFLOW_ENGINE,
      resolve: '@medusajs/workflow-engine-redis',
      options: {
        redis: {
          url: REDIS_URL,
        }
      }
    }] : []),
    ...(SENDGRID_API_KEY && SENDGRID_FROM_EMAIL || RESEND_API_KEY && RESEND_FROM_EMAIL ? [{
      key: Modules.NOTIFICATION,
      resolve: '@medusajs/notification',
      options: {
        providers: [
          ...(SENDGRID_API_KEY && SENDGRID_FROM_EMAIL ? [{
            resolve: '@medusajs/notification-sendgrid',
            id: 'sendgrid',
            options: {
              channels: ['email'],
              api_key: SENDGRID_API_KEY,
              from: SENDGRID_FROM_EMAIL,
            }
          }] : []),
          ...(RESEND_API_KEY && RESEND_FROM_EMAIL ? [{
            resolve: './src/modules/email-notifications',
            id: 'resend',
            options: {
              channels: ['email'],
              api_key: RESEND_API_KEY,
              from: RESEND_FROM_EMAIL,
            },
          }] : []),
        ]
      }
    }] : []),
    // ═══ Payment Module — always on, with Mollie + optional Stripe ═══
    {
      resolve: '@medusajs/medusa/payment',
      options: {
        providers: [
          {
            resolve: './src/modules/payment-mollie',
            id: 'mollie',
            options: {
              ...(MOLLIE_API_KEY ? { apiKey: MOLLIE_API_KEY, testMode: MOLLIE_TEST_MODE } : {}),
            },
          },
          ...(KLARNA_API_KEY && KLARNA_SECRET_KEY ? [{
            resolve: './src/modules/payment-klarna',
            id: 'klarna',
            options: {
              apiKey: KLARNA_API_KEY,
              secretKey: KLARNA_SECRET_KEY,
              testMode: KLARNA_TEST_MODE,
            },
          }] : []),
          ...(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET ? [{
            resolve: './src/modules/payment-paypal',
            id: 'paypal',
            options: {
              clientId: PAYPAL_CLIENT_ID,
              clientSecret: PAYPAL_CLIENT_SECRET,
              mode: PAYPAL_MODE,
            },
          }] : []),
          ...(PAYPAL_CLIENT_ID_EC && PAYPAL_CLIENT_SECRET_EC ? [{
            resolve: './src/modules/payment-paypal',
            id: 'paypal-ec',
            options: {
              clientId: PAYPAL_CLIENT_ID_EC,
              clientSecret: PAYPAL_CLIENT_SECRET_EC,
              mode: PAYPAL_MODE_EC,
            },
          }] : []),
          ...(AIRWALLEX_CLIENT_ID && AIRWALLEX_API_KEY ? [{
            resolve: './src/modules/payment-airwallex',
            id: 'airwallex',
            options: {
              clientId: AIRWALLEX_CLIENT_ID,
              apiKey: AIRWALLEX_API_KEY,
              testMode: AIRWALLEX_TEST_MODE,
              accountId: AIRWALLEX_ACCOUNT_ID,
            },
          }] : []),
          {
            resolve: './src/modules/payment-stripe',
            id: 'stripe',
            options: {
              secretKey: STRIPE_SECRET_KEY || '',
              publishableKey: STRIPE_PUBLISHABLE_KEY || '',
              webhookSecret: STRIPE_WEBHOOK_SECRET || '',
              testMode: STRIPE_TEST_MODE,
            },
          },
        ],
      },
    }
  ],
  plugins: [
  ...(MEILISEARCH_HOST && MEILISEARCH_ADMIN_KEY ? [{
      resolve: '@rokmohar/medusa-plugin-meilisearch',
      options: {
        config: {
          host: MEILISEARCH_HOST,
          apiKey: MEILISEARCH_ADMIN_KEY
        },
        settings: {
          products: {
            type: 'products',
            enabled: true,
            fields: ['id', 'title', 'description', 'handle', 'variant_sku', 'thumbnail'],
            indexSettings: {
              searchableAttributes: ['title', 'description', 'variant_sku'],
              displayedAttributes: ['id', 'handle', 'title', 'description', 'variant_sku', 'thumbnail'],
              filterableAttributes: ['id', 'handle'],
            },
            primaryKey: 'id',
          }
        }
      }
    }] : [])
  ]
};

console.log(JSON.stringify(medusaConfig, null, 2));
export default defineConfig(medusaConfig);
