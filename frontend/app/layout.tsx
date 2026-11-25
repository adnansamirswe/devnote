import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://devnote.byzo.cc";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0d" },
  ],
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "devnote — Developer Notepad for Clients, Projects & Cloud Accounts",
    template: "%s | devnote",
  },
  description:
    "Open-source, self-hosted developer notepad to track clients, projects, and cloud services (Supabase, Vercel, Cloudflare, AWS, Stripe) so you never lose track of which account owns what.",
  applicationName: "devnote",
  keywords: [
    "devnote",
    "developer notepad",
    "client project tracker",
    "cloud account tracker",
    "infrastructure notes",
    "developer workstation",
    "supabase account tracker",
    "self-hosted cloudflare d1",
    "open source developer tools",
    "byzo",
  ],
  authors: [{ name: "Byzo", url: "https://byzo.cc" }],
  creator: "Byzo",
  publisher: "Byzo",
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png" },
    ],
    apple: [
      { url: "/logo.png", type: "image/png" },
    ],
    shortcut: "/logo.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "devnote",
    title: "devnote — Developer Notepad for Clients, Projects & Cloud Accounts",
    description:
      "Track every client’s stack, services, and account ownership in one fast, self-hosted developer workstation. Built by Byzo.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "devnote — Developer notepad for tracking clients, projects, and cloud services",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "devnote — Developer Notepad for Clients, Projects & Cloud Accounts",
    description:
      "Never lose track of which account owns what service. Open-source, self-hosted on Cloudflare Workers + D1.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "devnote",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  image: `${SITE_URL}/og-image.png`,
  description:
    "Open-source developer notepad to track clients, projects, and cloud services with auto-matched brand badges and smart copy pills.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  author: {
    "@type": "Organization",
    name: "Byzo",
    url: "https://byzo.cc",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${plusJakartaSans.variable} ${geistMono.variable} font-sans antialiased min-h-screen bg-background text-foreground`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
