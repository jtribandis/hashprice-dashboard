
import React from "react";
export function Label({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return <label className={`block ${className}`}>{children}</label>;
}
