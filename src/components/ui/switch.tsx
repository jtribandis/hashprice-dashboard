
import React from "react";
export function Switch({ checked, onCheckedChange }: { checked?: boolean; onCheckedChange?: (v: boolean)=>void }) {
  return (
    <input
      type="checkbox"
      checked={!!checked}
      onChange={(e)=> onCheckedChange && onCheckedChange(e.target.checked)}
      className="w-10 h-5 accent-indigo-500"
    />
  );
}
