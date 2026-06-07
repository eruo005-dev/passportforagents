import { ClerkLoading, ClerkLoaded, SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      {/* Feedback while Clerk JS initializes — no more blank dark screen. */}
      <ClerkLoading>
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center gap-3 text-muted-foreground"
        >
          <span
            aria-hidden
            className="size-6 animate-spin rounded-full border-2 border-border border-t-foreground"
          />
          <span className="text-sm">Loading sign-in…</span>
        </div>
      </ClerkLoading>
      <ClerkLoaded>
        <SignIn />
      </ClerkLoaded>
    </div>
  );
}
