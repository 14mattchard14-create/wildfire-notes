import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Standard shadcn/ui helper: merges Tailwind classes intelligently,
// resolving conflicts (e.g. "px-2" vs "px-4") in favor of the later class.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
