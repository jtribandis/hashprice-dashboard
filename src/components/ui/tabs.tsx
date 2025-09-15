import React from "react";

type TabsProps = {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  className?: string;
  children?: React.ReactNode;
};

type TabsContextType = {
  value: string;
  setValue: (v: string) => void;
};

const TabsContext = React.createContext<TabsContextType | null>(null);

export function Tabs({ defaultValue, value, onValueChange, className = "", children }: TabsProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? "");

  const current = value !== undefined ? value : internal;
  const setValue = (v: string) => {
    if (onValueChange) onValueChange(v);
    if (value === undefined) setInternal(v);
  };

  return (
    <div className={className}>
      <TabsContext.Provider value={{ value: current, setValue }}>
        {children}
      </TabsContext.Provider>
    </div>
  );
}

export function TabsList({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return <div className={`flex gap-2 ${className}`}>{children}</div>;
}

export function TabsTrigger({
  value,
  children,
}: {
  value: string;
  children?: React.ReactNode;
}) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) return null;
  const isActive = ctx.value === value;
  return (
    <button
      onClick={() => ctx.setValue(value)}
      className={`px-2 py-1 rounded border ${isActive ? "bg-neutral-700 border-neutral-600" : "bg-neutral-800 border-neutral-700"}`}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
}: {
  value: string;
  children?: React.ReactNode;
}) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) return null;
  if (ctx.value !== value) return null;
  return <div className="mt-2">{children}</div>;
}
