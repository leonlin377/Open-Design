import * as React from "react";

export type KeyValueItem = {
  label: React.ReactNode;
  value: React.ReactNode;
};

export type KeyValueProps = React.HTMLAttributes<HTMLDListElement> & {
  items: readonly KeyValueItem[];
  layout?: "beside" | "above";
};

/**
 * KeyValue — renders a semantic definition list. `layout=beside` puts the
 * label in a left column; `layout=above` stacks label over value.
 */
export function KeyValue({
  items,
  layout = "beside",
  className,
  ...rest
}: KeyValueProps) {
  return (
    <dl
      data-layout={layout}
      className={`odp-kv${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {items.map((item, idx) => (
        <div key={idx} className="odp-kv-row">
          <dt className="odp-kv-label">{item.label}</dt>
          <dd className="odp-kv-value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
