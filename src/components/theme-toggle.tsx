"use client";

import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  // Which icon shows is decided by CSS off the `.dark` class next-themes
  // puts on <html> — no mounted-state gate, so nothing to hydrate-mismatch
  // and no setState-in-effect. resolvedTheme is only read on click, by
  // which point the client is live.
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle light and dark theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </Button>
  );
}
