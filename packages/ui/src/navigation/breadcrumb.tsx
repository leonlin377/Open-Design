"use client";

import * as React from "react";

export type BreadcrumbItem = {
  label: React.ReactNode;
  href?: string;
  current?: boolean;
};

export type BreadcrumbProps = React.HTMLAttributes<HTMLElement> & {
  items: readonly BreadcrumbItem[];
  separator?: React.ReactNode;
  maxItems?: number;
  ariaLabel?: string;
};

/**
 * Breadcrumb — last item marked `aria-current="page"`. When `maxItems` is
 * set and the list overflows, the middle items collapse into an ellipsis.
 */
export function Breadcrumb({
  items,
  separator = "/",
  maxItems,
  ariaLabel = "Breadcrumb",
  className,
  ...rest
}: BreadcrumbProps) {
  const shown = React.useMemo(() => {
    if (!maxItems || items.length <= maxItems) return items.map((i) => ({ ...i, kind: "item" as const }));
    const first = items[0];
    const last = items.slice(-Math.max(maxItems - 2, 1));
    return [
      { ...first, kind: "item" as const },
      { kind: "ellipsis" as const, label: "\u2026" },
      ...last.map((i) => ({ ...i, kind: "item" as const }))
    ];
  }, [items, maxItems]);

  return (
    <nav aria-label={ariaLabel} className={className} {...rest}>
      <ol className="odp-breadcrumb">
        {shown.map((entry, idx) => {
          const isLast = idx === shown.length - 1;
          const key = idx;
          if (entry.kind === "ellipsis") {
            return (
              <li key={key} aria-hidden>
                <span>{entry.label}</span>
                {!isLast ? (
                  <span className="odp-breadcrumb-sep" style={{ marginLeft: 6 }}>
                    {separator}
                  </span>
                ) : null}
              </li>
            );
          }
          const isCurrent = entry.current || (isLast && !entry.href);
          return (
            <li key={key} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {entry.href && !isCurrent ? (
                <a href={entry.href}>{entry.label}</a>
              ) : (
                <span aria-current={isCurrent ? "page" : undefined}>{entry.label}</span>
              )}
              {!isLast ? (
                <span className="odp-breadcrumb-sep" aria-hidden>
                  {separator}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
