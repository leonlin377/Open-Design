"use client";

import * as React from "react";

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
  baseId: string;
  registerTab: (value: string) => void;
  triggerOrder: React.MutableRefObject<string[]>;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

export type TabsProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

/**
 * Tabs — controlled or uncontrolled root. Wires a context so `TabsList`
 * can register triggers and handle keyboard navigation.
 */
export function Tabs({
  value,
  defaultValue,
  onValueChange,
  className,
  children,
  ...rest
}: TabsProps) {
  const [internal, setInternal] = React.useState<string>(defaultValue ?? "");
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;
  const baseId = React.useId();
  const triggerOrder = React.useRef<string[]>([]);

  const setValue = React.useCallback(
    (next: string) => {
      if (!isControlled) setInternal(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange]
  );

  const registerTab = React.useCallback((v: string) => {
    if (!triggerOrder.current.includes(v)) {
      triggerOrder.current.push(v);
    }
  }, []);

  const ctx = React.useMemo<TabsContextValue>(
    () => ({ value: current, setValue, baseId, registerTab, triggerOrder }),
    [current, setValue, baseId, registerTab]
  );

  return (
    <TabsContext.Provider value={ctx}>
      <div className={`odp-tabs${className ? ` ${className}` : ""}`} {...rest}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

function useTabs(): TabsContextValue {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("Tabs subcomponents must be used within <Tabs>");
  return ctx;
}

export type TabsListProps = React.HTMLAttributes<HTMLDivElement> & {
  "aria-label"?: string;
};

export function TabsList({ className, children, ...rest }: TabsListProps) {
  return (
    <div
      role="tablist"
      className={`odp-tabs-list${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export type TabsTriggerProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "value"
> & {
  value: string;
};

export function TabsTrigger({
  value,
  className,
  onKeyDown,
  children,
  ...rest
}: TabsTriggerProps) {
  const ctx = useTabs();
  const isSelected = ctx.value === value;
  const id = `${ctx.baseId}-tab-${value}`;
  const panelId = `${ctx.baseId}-panel-${value}`;

  React.useEffect(() => {
    ctx.registerTab(value);
  }, [ctx, value]);

  const handleKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (event) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    const order = ctx.triggerOrder.current;
    const idx = order.indexOf(value);
    if (idx === -1) return;
    let nextValue: string | undefined;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextValue = order[(idx + 1) % order.length];
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextValue = order[(idx - 1 + order.length) % order.length];
    } else if (event.key === "Home") {
      nextValue = order[0];
    } else if (event.key === "End") {
      nextValue = order[order.length - 1];
    }
    if (nextValue && nextValue !== value) {
      event.preventDefault();
      ctx.setValue(nextValue);
      const root = event.currentTarget.closest(".odp-tabs");
      const nextEl = root?.querySelector<HTMLButtonElement>(
        `#${CSS.escape(`${ctx.baseId}-tab-${nextValue}`)}`
      );
      nextEl?.focus();
    }
  };

  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={isSelected}
      aria-controls={panelId}
      tabIndex={isSelected ? 0 : -1}
      onClick={() => ctx.setValue(value)}
      onKeyDown={handleKeyDown}
      className={`odp-tabs-trigger${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export type TabsPanelProps = React.HTMLAttributes<HTMLDivElement> & {
  value: string;
};

export function TabsPanel({
  value,
  className,
  children,
  ...rest
}: TabsPanelProps) {
  const ctx = useTabs();
  const isSelected = ctx.value === value;
  const id = `${ctx.baseId}-panel-${value}`;
  const labelId = `${ctx.baseId}-tab-${value}`;
  if (!isSelected) return null;
  return (
    <div
      role="tabpanel"
      id={id}
      aria-labelledby={labelId}
      tabIndex={0}
      className={`odp-tabs-panel${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {children}
    </div>
  );
}
