import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_DESCRIPTION =
  "Is this agent who it claims to be, and is it any good? Verification, a trust score, and a public registry for the open MCP ecosystem.";

export const metadata: Metadata = {
  metadataBase: new URL("https://passportforagents.com"),
  title: {
    default: "PassportForAgents — the verified-agent badge & trust API",
    template: "%s · PassportForAgents",
  },
  description: SITE_DESCRIPTION,
  applicationName: "PassportForAgents",
  // NOTE: no site-wide `alternates.canonical` here — a root-layout canonical
  // makes every page self-report the homepage as canonical (deindexing the
  // registry + agent profiles). Each route sets its own canonical instead.
  openGraph: {
    type: "website",
    siteName: "PassportForAgents",
    url: "https://passportforagents.com",
    title: "PassportForAgents — the verified-agent badge & trust API",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "PassportForAgents — the verified-agent badge & trust API",
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground min-h-full flex flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-background"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
