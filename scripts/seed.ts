import * as fs from "fs";
import * as path from "path";

export interface SeedService {
  id: string;
  projectId: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface SeedProject {
  id: string;
  clientId: string;
  name: string;
  details: string;
  createdAt: number;
  updatedAt: number;
  services: SeedService[];
}

export interface SeedClient {
  id: string;
  name: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
  projects: SeedProject[];
}

const now = Date.now();

export const demoSeedData: { clients: SeedClient[] } = {
  clients: [
    {
      id: "client-acme-global",
      name: "Acme Global",
      notes: "Enterprise retail logistics client. Primary contact: ops-lead@acmeglobal.com. SLA: 99.9%.",
      createdAt: now - 30 * 24 * 60 * 60 * 1000,
      updatedAt: now,
      projects: [
        {
          id: "proj-acme-portal",
          clientId: "client-acme-global",
          name: "B2B Customer Portal",
          details: "Next.js dashboard hosted on Vercel, Supabase backend in us-east-1, Stripe billing integration.",
          createdAt: now - 25 * 24 * 60 * 60 * 1000,
          updatedAt: now,
          services: [
            {
              id: "srv-acme-supabase",
              projectId: "proj-acme-portal",
              name: "Supabase",
              description: "Database cluster in `us-east-1`.\n\n- Owner account: `infra-acme@byzo.cc`\n- Plan: Pro tier (auto-pause disabled)\n- Project URL: `https://acme-prod.supabase.co`\n- Backup window: Daily 02:00 UTC",
              createdAt: now - 25 * 24 * 60 * 60 * 1000,
              updatedAt: now,
            },
            {
              id: "srv-acme-vercel",
              projectId: "proj-acme-portal",
              name: "Vercel",
              description: "Frontend production deployments.\n\n- Team: `acme-global-team`\n- Admin: `lead-dev@byzo.cc`\n- Production domain: `portal.acmeglobal.com`",
              createdAt: now - 24 * 24 * 60 * 60 * 1000,
              updatedAt: now,
            },
            {
              id: "srv-acme-stripe",
              projectId: "proj-acme-portal",
              name: "Stripe",
              description: "Merchant account for invoicing and customer subscriptions.\n\n- Account ID: `acct_1N9xAcmePortal`\n- Finance contact: `billing@acmeglobal.com`\n- Webhook endpoint configured on edge API.",
              createdAt: now - 20 * 24 * 60 * 60 * 1000,
              updatedAt: now,
            },
          ],
        },
        {
          id: "proj-acme-queue-worker",
          clientId: "client-acme-global",
          name: "Warehouse Queue Sync",
          details: "Real-time edge event consumer processing order updates.",
          createdAt: now - 15 * 24 * 60 * 60 * 1000,
          updatedAt: now,
          services: [
            {
              id: "srv-acme-cf-worker",
              projectId: "proj-acme-queue-worker",
              name: "Cloudflare",
              description: "Cloudflare Worker with Queues and KV cache.\n\n- Zone account: `acme-network@byzo.cc`\n- Worker name: `order-sync-pipeline`\n- Max throughput: 5,000 req/min",
              createdAt: now - 15 * 24 * 60 * 60 * 1000,
              updatedAt: now,
            },
            {
              id: "srv-acme-redis",
              projectId: "proj-acme-queue-worker",
              name: "Redis",
              description: "Upstash Serverless Redis for deduplication and rate limiting.\n\n- Host: `us1-acme-sync.upstash.io`\n- Owner email: `systems@byzo.cc`",
              createdAt: now - 14 * 24 * 60 * 60 * 1000,
              updatedAt: now,
            },
          ],
        },
      ],
    },
    {
      id: "client-hyperscale-ai",
      name: "HyperScale AI",
      notes: "Machine learning research lab. High-compute inference services.",
      createdAt: now - 45 * 24 * 60 * 60 * 1000,
      updatedAt: now,
      projects: [
        {
          id: "proj-hyper-infer",
          clientId: "client-hyperscale-ai",
          name: "Inference Engine API",
          details: "FastAPI inference microservice deployed on AWS GPU clusters.",
          createdAt: now - 40 * 24 * 60 * 60 * 1000,
          updatedAt: now,
          services: [
            {
              id: "srv-hyper-aws",
              projectId: "proj-hyper-infer",
              name: "AWS",
              description: "EC2 G5 GPU instances and S3 model artifact storage.\n\n- Root account: `cloud-admin@hyperscale.ai`\n- IAM Role: `arn:aws:iam::123456789012:role/ModelDeployer`\n- Primary region: `us-west-2`",
              createdAt: now - 40 * 24 * 60 * 60 * 1000,
              updatedAt: now,
            },
            {
              id: "srv-hyper-posthog",
              projectId: "proj-hyper-infer",
              name: "PostHog",
              description: "Product and LLM prompt telemetry.\n\n- Project: `Hyperscale Production Analytics`\n- Team owner: `data-eng@hyperscale.ai`",
              createdAt: now - 35 * 24 * 60 * 60 * 1000,
              updatedAt: now,
            },
          ],
        },
      ],
    },
    {
      id: "client-nextgen-store",
      name: "NextGen Commerce",
      notes: "Headless e-commerce brand operating on Shopify Plus.",
      createdAt: now - 60 * 24 * 60 * 60 * 1000,
      updatedAt: now,
      projects: [
        {
          id: "proj-nextgen-storefront",
          clientId: "client-nextgen-store",
          name: "Headless Storefront",
          details: "Next.js storefront with Sanity CMS for product campaigns.",
          createdAt: now - 50 * 24 * 60 * 60 * 1000,
          updatedAt: now,
          services: [
            {
              id: "srv-nextgen-neon",
              projectId: "proj-nextgen-storefront",
              name: "Neon",
              description: "Serverless Postgres database for cart persistence.\n\n- Project: `nextgen-cart-db`\n- Admin email: `devops@nextgen.com`\n- Autoscaling: 0.25 to 2 CU",
              createdAt: now - 50 * 24 * 60 * 60 * 1000,
              updatedAt: now,
            },
            {
              id: "srv-nextgen-resend",
              projectId: "proj-nextgen-storefront",
              name: "Resend",
              description: "Transactional order confirmation and shipment dispatch emails.\n\n- Sending domain: `mail.nextgen.com`\n- DKIM/SPF verified on Cloudflare DNS\n- Team admin: `marketing@nextgen.com`",
              createdAt: now - 48 * 24 * 60 * 60 * 1000,
              updatedAt: now,
            },
          ],
        },
      ],
    },
  ],
};

function main() {
  const outputPath = path.join(__dirname, "seed-backup.json");
  fs.writeFileSync(outputPath, JSON.stringify(demoSeedData, null, 2));
  console.log(`[seed] Demo backup written to: ${outputPath}`);
  console.log(`[seed] Total Clients: ${demoSeedData.clients.length}`);
  console.log(`[seed] Ready to import via the /app settings UI or /api/import endpoint.`);
}

main();
