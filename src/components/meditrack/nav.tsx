import type { Screen } from "@/lib/meditrack/types";
import { createContext, useContext, useState, type ReactNode } from "react";

type Nav = {
  screen: Screen;
  go: (screen: Screen) => void;
  back: () => void;
  reset: (screen: Screen) => void;
  setTop: (screen: Screen) => void;
};

const Ctx = createContext<Nav | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Screen[]>([{ name: "today" }]);
  const screen = stack[stack.length - 1] ?? { name: "today" };
  const value: Nav = {
    screen,
    go: (next) => setStack((st) => [...st, next]),
    back: () => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st)),
    reset: (next) => setStack([next]),
    setTop: (next) => setStack((st) => [...st.slice(0, -1), next]),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNav(): Nav {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Navigation is unavailable");
  return ctx;
}

export function tabOf(screen: Screen): "today" | "meds" | "stats" | "more" {
  if (screen.name === "meds" || screen.name === "med") return "meds";
  if (screen.name === "stats" || screen.name === "history" || screen.name === "report") return "stats";
  if (screen.name === "today") return "today";
  return "more";
}
