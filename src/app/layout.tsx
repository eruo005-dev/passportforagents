import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
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
  alternates: { canonical: "/" },
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={{ baseTheme: dark }}>
      <html
        lang="en"
        className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="bg-background text-foreground min-h-full flex flex-col font-sans">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
