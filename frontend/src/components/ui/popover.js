import { forwardRef } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { html } from "../../html.js";

export const Popover = PopoverPrimitive.Root;
export const PopoverAnchor = PopoverPrimitive.Anchor;

/** Styling comes from the ported `.cal-pop` class. */
export const PopoverContent = forwardRef(
  ({ className, align = "start", sideOffset = 6, collisionPadding = 8, style, ...props }, ref) => html`
    <${PopoverPrimitive.Portal}>
      <${PopoverPrimitive.Content}
        ref=${ref}
        align=${align}
        sideOffset=${sideOffset}
        collisionPadding=${collisionPadding}
        onOpenAutoFocus=${(e) => e.preventDefault()}
        onCloseAutoFocus=${(e) => e.preventDefault()}
        className=${`cal-pop open ${className ?? ""}`.trim()}
        style=${{ position: "relative", ...style }}
        ...${props}
      />
    <//>
  `
);
PopoverContent.displayName = "PopoverContent";
