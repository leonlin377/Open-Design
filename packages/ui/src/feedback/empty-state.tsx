import * as React from "react";

export type EmptyStateProps = React.HTMLAttributes<HTMLDivElement> & {
  icon?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  action?: React.ReactNode;
};

/**
 * EmptyState — icon + headline + body + optional action. Centered, generous
 * padding, intended for zero-data panels.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
  ...rest
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={`odp-empty${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {icon ? <div className="odp-empty-icon" aria-hidden>{icon}</div> : null}
      <div className="odp-empty-title">{title}</div>
      {body !== undefined ? <div className="odp-empty-body">{body}</div> : null}
      {action !== undefined ? <div>{action}</div> : null}
    </div>
  );
}
