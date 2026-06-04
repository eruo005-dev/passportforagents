import { cn } from "@/lib/utils";

export type AgentStatus =
  | "unverified"
  | "domain_verified"
  | "key_verified"
  | "suspended";

const STATUS: Record<
  AgentStatus,
  { label: string; className: string; dot: string }
> = {
  key_verified: {
    label: "Key verified",
    className: "border-success/40 bg-success/10 text-success",
    dot: "bg-success",
  },
  domain_verified: {
    label: "Domain verified",
    className: "border-warning/40 bg-warning/10 text-warning",
    dot: "bg-warning",
  },
  unverified: {
    label: "Unverified",
    className: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  suspended: {
    label: "Suspended",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
};

export function VerificationBadge({
  status,
  className,
}: {
  status: AgentStatus;
  className?: string;
}) {
  const s = STATUS[status] ?? STATUS.unverified;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        s.className,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}
