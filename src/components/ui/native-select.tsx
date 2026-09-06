import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A native <select> styled to match Input.
 *
 * Native rather than the Base UI Select in ./select.tsx on purpose: these are
 * plain form fields inside `action={...}` forms, and a real <select> submits
 * itself, works with the phone's own wheel picker, and handles a term's worth
 * of grouped options without a scroll container.
 *
 * The colours all have to be stated outright. The closed control inherited
 * whatever colour it sat in, and the drop-down list is drawn by the browser
 * from the *options'* own colours — set neither and both render in a system
 * palette that comes out washed-out, badly so on the dark theme.
 */
function NativeSelect({
  className,
  value,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        value={value}
        // Greys the closed control while it still reads "Choose a course".
        // The alternative — leaning on the placeholder <option disabled> —
        // greys it through a UA rule we'd then have to fight to get a real
        // selection back to full strength.
        data-placeholder={value === "" ? "" : undefined}
        className={cn(
          "h-9 w-full appearance-none rounded-lg border border-input bg-transparent py-1 pr-8 pl-2.5 text-sm text-foreground transition-colors outline-none dark:bg-input/30",
          "data-placeholder:text-muted-foreground",
          // The list itself.
          "[&_option]:bg-popover [&_option]:text-popover-foreground",
          "[&_option:disabled]:text-muted-foreground",
          "[&_optgroup]:bg-popover [&_optgroup]:font-medium [&_optgroup]:text-muted-foreground",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:bg-input/50 disabled:text-muted-foreground dark:disabled:bg-input/80",
          className
        )}
        {...props}
      />
      {/* appearance-none drops the browser's own arrow, so supply one. */}
      <ChevronDownIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

export { NativeSelect };
