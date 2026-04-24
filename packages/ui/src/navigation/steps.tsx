import * as React from "react";

export type StepItem = {
  title: React.ReactNode;
  description?: React.ReactNode;
  state?: "pending" | "current" | "complete";
};

export type StepsProps = React.HTMLAttributes<HTMLOListElement> & {
  steps: readonly StepItem[];
  current?: number;
  orientation?: "horizontal" | "vertical";
  ariaLabel?: string;
};

/**
 * Steps — numbered progress indicator. If `current` is provided, states are
 * computed automatically (complete < current, current == idx, pending >).
 */
export function Steps({
  steps,
  current,
  orientation = "horizontal",
  ariaLabel = "Progress",
  className,
  ...rest
}: StepsProps) {
  return (
    <ol
      data-orient={orientation}
      aria-label={ariaLabel}
      className={`odp-steps${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {steps.map((step, idx) => {
        let state: "pending" | "current" | "complete" = step.state ?? "pending";
        if (current !== undefined) {
          if (idx < current) state = "complete";
          else if (idx === current) state = "current";
          else state = "pending";
        }
        return (
          <li
            key={idx}
            data-state={state}
            className="odp-step"
            aria-current={state === "current" ? "step" : undefined}
          >
            <span className="odp-step-marker" aria-hidden>
              {state === "complete" ? (
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <path
                    d="M2.5 6L5 8.5L9.5 3.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                idx + 1
              )}
            </span>
            <span className="odp-step-body">
              <span className="odp-step-title">{step.title}</span>
              {step.description !== undefined ? (
                <span className="odp-step-desc">{step.description}</span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
