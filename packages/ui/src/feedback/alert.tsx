import * as React from "react";

export type AlertTone = "info" | "success" | "warn" | "danger";

export type AlertProps = Omit<React.HTMLAttributes<HTMLDivElement>, "title"> & {
  tone?: AlertTone;
  title?: React.ReactNode;
  onDismiss?: () => void;
  icon?: React.ReactNode;
};

function DefaultIcon({ tone }: { tone: AlertTone }) {
  // Simple geometric indicator per tone (circle w/ mark).
  if (tone === "danger" || tone === "warn") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <path d="M8 1.5L15 14H1L8 1.5Z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
        <path d="M8 6V9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
      </svg>
    );
  }
  if (tone === "success") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="6.75" stroke="currentColor" strokeWidth="1.4" fill="none" />
        <path d="M5 8.25L7.25 10.5L11 6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="6.75" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path d="M8 7V11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="5" r="0.8" fill="currentColor" />
    </svg>
  );
}

/**
 * Alert / Banner — inline notice with tone, icon, optional dismiss.
 */
export function Alert({
  tone = "info",
  title,
  icon,
  onDismiss,
  className,
  children,
  ...rest
}: AlertProps) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      data-tone={tone}
      className={`odp-alert${className ? ` ${className}` : ""}`}
      {...rest}
    >
      <span className="odp-alert-icon">
        {icon ?? <DefaultIcon tone={tone} />}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 auto", minWidth: 0 }}>
        {title !== undefined ? <div className="odp-alert-title">{title}</div> : null}
        {children !== undefined ? <div className="odp-alert-body">{children}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          aria-label="Dismiss"
          className="odp-alert-dismiss"
          onClick={onDismiss}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
