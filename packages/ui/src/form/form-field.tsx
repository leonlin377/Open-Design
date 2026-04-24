import * as React from "react";

export type FormFieldProps = React.HTMLAttributes<HTMLDivElement> & {
  label?: React.ReactNode;
  help?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  labelId?: string;
  children: React.ReactNode;
};

/**
 * FormField — wrapper giving label above + help/error below. Pass its
 * `htmlFor` to bind to the inner input id. Error supersedes help and
 * applies `aria-describedby` + `aria-errormessage` where supported.
 */
export function FormField({
  label,
  help,
  error,
  required,
  htmlFor,
  labelId,
  children,
  className,
  ...rest
}: FormFieldProps) {
  const helpId = React.useId();
  const errorId = React.useId();
  const describedBy = error ? errorId : help ? helpId : undefined;

  // If the child is a single element, inject aria-describedby / id bindings
  // so screen readers pick up help/error text.
  let content: React.ReactNode = children;
  if (
    React.isValidElement(children) &&
    typeof children.type !== "string"
      ? true
      : React.isValidElement(children)
  ) {
    const el = children as React.ReactElement<Record<string, unknown>>;
    const existing = el.props as Record<string, unknown>;
    const extra: Record<string, unknown> = {};
    if (htmlFor && existing["id"] === undefined) extra["id"] = htmlFor;
    if (describedBy && existing["aria-describedby"] === undefined) {
      extra["aria-describedby"] = describedBy;
    }
    if (error && existing["aria-invalid"] === undefined) {
      extra["aria-invalid"] = true;
    }
    if (Object.keys(extra).length > 0) {
      content = React.cloneElement(el, extra);
    }
  }

  return (
    <div className={`odp-field${className ? ` ${className}` : ""}`} {...rest}>
      {label !== undefined ? (
        <label
          id={labelId}
          htmlFor={htmlFor}
          className="odp-field-label"
        >
          {label}
          {required ? <span className="odp-field-required" aria-hidden>*</span> : null}
        </label>
      ) : null}
      {content}
      {error ? (
        <span id={errorId} role="alert" className="odp-field-error">
          {error}
        </span>
      ) : help ? (
        <span id={helpId} className="odp-field-help">
          {help}
        </span>
      ) : null}
    </div>
  );
}
