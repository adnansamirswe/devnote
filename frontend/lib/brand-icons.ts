import * as icons from "simple-icons";

// Map aliases or normalized names to simple-icons keys
const customAliases: Record<string, string> = {
  supabase: "siSupabase",
  vercel: "siVercel",
  cloudflare: "siCloudflare",
  aws: "siAmazonwebservices",
  "amazon web services": "siAmazonwebservices",
  google: "siGoogle",
  "google cloud": "siGooglecloud",
  gcp: "siGooglecloud",
  firebase: "siFirebase",
  github: "siGithub",
  gitlab: "siGitlab",
  stripe: "siStripe",
  neon: "siNeon",
  resend: "siResend",
  posthog: "siPosthog",
  sentry: "siSentry",
  planetscale: "siPlanetscale",
  railway: "siRailway",
  render: "siRender",
  fly: "siFlydotio",
  "fly.io": "siFlydotio",
  mongodb: "siMongodb",
  postgres: "siPostgresql",
  postgresql: "siPostgresql",
  mysql: "siMysql",
  redis: "siRedis",
  upstash: "siUpstash",
  docker: "siDocker",
  auth0: "siAuth0",
  clerk: "siClerk",
  twilio: "siTwilio",
  sendgrid: "siSendgrid",
  mailgun: "siMailgun",
  digitalocean: "siDigitalocean",
  heroku: "siHeroku",
  openai: "siOpenai",
  anthropic: "siAnthropic",
  slack: "siSlack",
  discord: "siDiscord",
  notion: "siNotion",
  linear: "siLinear",
  jira: "siJira",
  datadog: "siDatadog",
  algolia: "siAlgolia",
};

export interface BrandIconResult {
  svg: string;
  hex: string;
  title: string;
}

export function matchBrandIcon(serviceName: string): BrandIconResult | null {
  if (!serviceName) return null;
  const normalized = serviceName.trim().toLowerCase();

  // 1. Direct alias lookup
  if (customAliases[normalized]) {
    const key = customAliases[normalized];
    const icon = (icons as Record<string, any>)[key];
    if (icon) {
      return { svg: icon.svg, hex: `#${icon.hex}`, title: icon.title };
    }
  }

  // 2. Exact or normalized matching in simple-icons
  const clean = normalized.replace(/[^a-z0-9]/g, "");
  const simpleIconsKey = `si${clean.charAt(0).toUpperCase()}${clean.slice(1)}`;
  if ((icons as Record<string, any>)[simpleIconsKey]) {
    const icon = (icons as Record<string, any>)[simpleIconsKey];
    return { svg: icon.svg, hex: `#${icon.hex}`, title: icon.title };
  }

  // 3. Substring check
  for (const [alias, key] of Object.entries(customAliases)) {
    if (normalized.includes(alias)) {
      const icon = (icons as Record<string, any>)[key];
      if (icon) {
        return { svg: icon.svg, hex: `#${icon.hex}`, title: icon.title };
      }
    }
  }

  return null;
}
