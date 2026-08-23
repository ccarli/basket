import { forwardRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { html } from "../../html.js";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogTitle = DialogPrimitive.Title;
export const DialogClose = DialogPrimitive.Close;

/**
 * Styling comes from the ported `.pop-mask` / `.pop` classes; the content sits
 * inside the overlay so the mask's flex centring positions it.
 */
export const DialogContent = forwardRef(({ className, children, ...props }, ref) => html`
  <${DialogPrimitive.Portal}>
    <${DialogPrimitive.Overlay} className="pop-mask open">
      <${DialogPrimitive.Content} ref=${ref} className=${`pop ${className ?? ""}`.trim()} ...${props}>
        ${children}
      <//>
    <//>
  <//>
`);
DialogContent.displayName = "DialogContent";
