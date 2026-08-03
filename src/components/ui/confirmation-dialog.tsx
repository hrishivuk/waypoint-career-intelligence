"use client";

import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  busy = false,
  onConfirm,
  onOpenChange,
}: ConfirmationDialogProps) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-[color-mix(in_srgb,var(--shell-background)_70%,transparent)] backdrop-blur-sm transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialogPrimitive.Viewport className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
          <AlertDialogPrimitive.Popup className="w-full max-w-md rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-2xl outline-none transition data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <span className="flex size-10 items-center justify-center rounded-full bg-[var(--danger-background)] text-[var(--danger)]">
              <AlertTriangle aria-hidden="true" className="size-5" />
            </span>
            <AlertDialogPrimitive.Title className="mt-4 text-lg font-semibold tracking-[var(--tracking-tight)] text-foreground">
              {title}
            </AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="mt-2 text-sm leading-6 text-muted-foreground">
              {description}
            </AlertDialogPrimitive.Description>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <AlertDialogPrimitive.Close
                render={<Button type="button" variant="outline" disabled={busy} />}
              >
                Cancel
              </AlertDialogPrimitive.Close>
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={onConfirm}
              >
                {busy ? "Working…" : confirmLabel}
              </Button>
            </div>
          </AlertDialogPrimitive.Popup>
        </AlertDialogPrimitive.Viewport>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
