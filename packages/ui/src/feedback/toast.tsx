"use client";

import * as React from "react";

export type ToastTone = "default" | "info" | "success" | "warn" | "danger";

export type ToastInput = {
  id?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  tone?: ToastTone;
  duration?: number;
};

type ToastRecord = Required<Pick<ToastInput, "id" | "duration">> & ToastInput;

type ToastContextValue = {
  toasts: ToastRecord[];
  push: (input: ToastInput) => string;
  dismiss: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

export type ToastProviderProps = {
  children?: React.ReactNode;
  defaultDuration?: number;
};

/**
 * ToastProvider — owns the stack + viewport. Auto-dismisses each toast after
 * `duration` ms (default 4000). Stacks at bottom-right.
 */
export function ToastProvider({
  children,
  defaultDuration = 4000
}: ToastProviderProps) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);
  const counter = React.useRef(0);
  const timers = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const push = React.useCallback(
    (input: ToastInput) => {
      counter.current += 1;
      const id = input.id ?? `t${counter.current}`;
      const duration = input.duration ?? defaultDuration;
      const record: ToastRecord = { id, duration, ...input };
      setToasts((prev) => [...prev, record]);
      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [defaultDuration, dismiss]
  );

  React.useEffect(() => {
    return () => {
      timers.current.forEach((t) => clearTimeout(t));
      timers.current.clear();
    };
  }, []);

  const ctx = React.useMemo<ToastContextValue>(
    () => ({ toasts, push, dismiss }),
    [toasts, push, dismiss]
  );

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div
        className="odp-toast-viewport"
        aria-live="polite"
        aria-atomic="false"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ toast, onClose }: { toast: ToastRecord; onClose: () => void }) {
  return (
    <div role="status" className="odp-toast" data-tone={toast.tone ?? "default"}>
      <div className="odp-toast-body">
        {toast.title !== undefined ? (
          <div className="odp-toast-title">{toast.title}</div>
        ) : null}
        {toast.description !== undefined ? (
          <div className="odp-toast-desc">{toast.description}</div>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onClose}
        className="odp-toast-close"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
