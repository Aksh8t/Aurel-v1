"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function IntegrationDialog({
  title,
  description,
  fields,
  onSubmit,
  triggerLabel
}: {
  title: string;
  description: string;
  triggerLabel: string;
  fields: Array<{ id: string; label: string; type?: string; placeholder?: string }>;
  onSubmit: (values: Record<string, string>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" type="button">
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {fields.map((field) => (
            <div className="space-y-1" key={field.id}>
              <label className="text-sm font-medium text-zinc-700">{field.label}</label>
              <Input
                placeholder={field.placeholder}
                type={field.type ?? "text"}
                value={values[field.id] ?? ""}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field.id]: event.target.value }))
                }
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                await onSubmit(values);
                setOpen(false);
                setValues({});
              } catch (error) {
                const message = error instanceof Error ? error.message : "Connection failed. Check your internet and try again.";
                toast.error(message);
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? "Connecting..." : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
