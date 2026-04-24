import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function prettifyApiError(_: unknown) {
  return "Connection failed. Check your internet and try again.";
}
