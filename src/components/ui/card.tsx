
import React from "react";
export function Card({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return <div className={`rounded-2xl border border-neutral-800 ${className}`}>{children}</div>;
}
export function CardHeader({ children }: { children?: React.ReactNode }) {
  return <div className="p-4 border-b border-neutral-800">{children}</div>;
}
export function CardTitle({ className="", children }: { className?: string; children?: React.ReactNode }) {
  return <h2 className={`text-lg font-semibold ${className}`}>{children}</h2>;
}
export function CardContent({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}
