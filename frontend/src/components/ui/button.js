import { forwardRef, createElement } from "react";

/** Variants map onto the ported `.btn` / `.icon-btn` classes. */
const VARIANTS = { default: "btn", primary: "btn primary", icon: "icon-btn" };

export const Button = forwardRef(({ className, variant = "default", ...props }, ref) =>
  createElement("button", {
    ref,
    className: `${VARIANTS[variant]} ${className ?? ""}`.trim(),
    ...props,
  })
);
Button.displayName = "Button";
