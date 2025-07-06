"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "light" | "dark" | "colored";
  showText?: boolean;
  clickable?: boolean;
  href?: string;
  className?: string;
}

const markSize = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-11 w-11",
  xl: "h-16 w-16",
};

const glyphSize = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-9 w-9",
};

const textSizeClasses = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-xl",
  xl: "text-3xl",
};

function Mark({
  size,
  variant,
}: {
  size: NonNullable<LogoProps["size"]>;
  variant: NonNullable<LogoProps["variant"]>;
}) {
  const light = variant === "light";
  return (
    <span
      className={cn(
        "relative inline-flex flex-shrink-0 items-center justify-center rounded-2xl",
        markSize[size],
        light
          ? "bg-white/10 ring-1 ring-white/20"
          : "bg-[#1c3a32] shadow-[inset_0_-8px_16px_rgba(0,0,0,0.18)]"
      )}
    >
      <svg
        viewBox="0 0 32 32"
        className={glyphSize[size]}
        aria-hidden="true"
      >
        <path
          d="M6 14.5 16 6l10 8.5V26a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V14.5Z"
          fill={light ? "#f6efe4" : "#f4e7d4"}
        />
        <path d="M13 27V18h6v9" fill={light ? "#d4a574" : "#c9894a"} />
      </svg>
    </span>
  );
}

export function Logo({
  size = "md",
  variant = "colored",
  showText = true,
  clickable = true,
  href = "/",
  className,
}: LogoProps) {
  const logoElement = (
    <div className={cn("flex items-center gap-2.5 md:gap-3", className)}>
      <Mark size={size} variant={variant} />
      {showText && (
        <span className="leading-none">
          <span
            className={cn(
              "block font-display font-semibold tracking-tight",
              textSizeClasses[size],
              variant === "light" ? "text-[#f6f1e8]" : "text-[#1a1814]"
            )}
          >
            OutReach
          </span>
          <span
            className={cn(
              "mt-1 block text-[10px] font-medium uppercase tracking-[0.22em]",
              variant === "light" ? "text-[#d4a574]" : "text-[#8a6a45]"
            )}
          >
            Property desk
          </span>
        </span>
      )}
    </div>
  );

  if (clickable) {
    return (
      <Link href={href} className="block transition-opacity duration-200 hover:opacity-80">
        {logoElement}
      </Link>
    );
  }

  return logoElement;
}

export function CompactLogo({
  size = "sm",
  variant = "colored",
  className,
}: Omit<LogoProps, "showText" | "clickable" | "href">) {
  return (
    <span className={className}>
      <Mark size={size} variant={variant} />
    </span>
  );
}
