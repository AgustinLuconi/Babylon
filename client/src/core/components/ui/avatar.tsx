import { cn } from "@/core/lib/utils";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export interface AvatarProps {
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
  tone?: "neutral" | "brand";
  className?: string;
}

export function Avatar({ name, size = "sm", tone = "neutral", className }: AvatarProps) {
  return (
    <div
      className={cn("avatar", size === "xs" && "avatar-xs", size === "md" && "avatar-md", size === "lg" && "avatar-lg", tone === "brand" && "avatar-brand", className)}
    >
      {initials(name)}
    </div>
  );
}
