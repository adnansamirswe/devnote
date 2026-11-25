import React from "react";

interface BrandWordmarkProps {
  className?: string;
}

export function BrandWordmark({ className = "text-[17px]" }: BrandWordmarkProps) {
  return (
    <span
      className={`inline-flex items-baseline font-sans font-extrabold tracking-[-0.025em] leading-none select-none ${className}`}
    >
      <span className="text-foreground">dev</span>
      <span className="text-primary/80 ml-[0.5px]">note</span>
      <span className="text-primary">.</span>
    </span>
  );
}
