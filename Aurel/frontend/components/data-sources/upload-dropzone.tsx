"use client";

import { FileUp } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function UploadDropzone({
  onFiles,
  disabled
}: {
  onFiles: (files: FileList | File[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center",
        disabled && "opacity-60"
      )}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        if (!disabled) onFiles(event.dataTransfer.files);
      }}
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
        <FileUp className="h-5 w-5 text-violet-600" />
      </div>
      <p className="mt-4 text-sm font-medium text-zinc-900">Drop interviews, PRDs, or audio here</p>
      <p className="mt-1 text-sm text-zinc-500">PDF, DOCX, TXT, MP3, MP4 up to 50MB</p>
      <input
        hidden
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.mp3,.mp4"
        onChange={(event) => {
          if (event.target.files && !disabled) onFiles(event.target.files);
        }}
      />
      <Button className="mt-4" variant="secondary" onClick={() => inputRef.current?.click()} type="button">
        Choose Files
      </Button>
    </div>
  );
}
