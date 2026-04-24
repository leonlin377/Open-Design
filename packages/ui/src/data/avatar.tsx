"use client";

import * as React from "react";

export type AvatarSize = "sm" | "md" | "lg";

export type AvatarProps = Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> & {
  size?: AvatarSize;
  src?: string;
  alt?: string;
  name?: string;
  initials?: string;
};

function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Avatar — image with graceful fallback to initials. Failing images swap
 * to the initials block via `onError`. If no image is supplied, initials
 * render directly.
 */
export function Avatar({
  size = "md",
  src,
  alt,
  name,
  initials,
  className,
  ...rest
}: AvatarProps) {
  const [errored, setErrored] = React.useState(false);
  const showImg = Boolean(src) && !errored;
  const fallback = initials ?? (name ? computeInitials(name) : "");

  return (
    <span
      data-size={size}
      role={src ? undefined : "img"}
      aria-label={src ? undefined : alt ?? name}
      className={`odp-avatar${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {showImg ? (
        <img
          src={src}
          alt={alt ?? name ?? ""}
          onError={() => setErrored(true)}
        />
      ) : (
        <span aria-hidden>{fallback}</span>
      )}
    </span>
  );
}
