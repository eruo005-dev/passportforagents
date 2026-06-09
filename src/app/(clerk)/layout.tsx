import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

/**
 * Clerk is scoped to this route group (/sign-in, /sign-up, /dashboard) so its
 * SDK only loads where auth UI actually renders — public pages stay Clerk-free
 * and ship dramatically less JavaScript. Server-side auth (proxy middleware,
 * `auth()`, `currentUser()`) works app-wide regardless of this provider.
 */
export default function ClerkLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider appearance={{ baseTheme: dark }} telemetry={false}>
      {children}
    </ClerkProvider>
  );
}
