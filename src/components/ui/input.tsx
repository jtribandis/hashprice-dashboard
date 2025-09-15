
import React from "react";
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={`px-2 py-1 rounded border border-neutral-300 ${className}`} {...rest} />;
}
