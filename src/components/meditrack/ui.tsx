import { cn } from "@/lib/cn";
import { t, type Key } from "@/lib/meditrack/i18n";
import { useMedi } from "@/lib/meditrack/store";
import type { Lang } from "@/lib/meditrack/types";
import { X } from "lucide-react";
import { useEffect, useCallback, type ButtonHTMLAttributes, type ReactNode } from "react";

export function useT() {
  const lang = useMedi((s) => s.lang);
  return useCallback((key: Key, vars?: Record<string, string | number>) => t(lang, key, vars), [lang]);
}

export function useLang(): Lang {
  return useMedi((s) => s.lang);
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "soft" | "ghost" | "clay" | "bad" | "quiet";
  block?: boolean;
};

export function Btn({ variant = "primary", block, className, type = "button", ...props }: BtnProps) {
  return <button type={type} className={cn("btn", `btn-${variant}`, block && "btn-block", className)} {...props} />;
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="text-sm text-muted">{hint}</span> : null}
    </label>
  );
}

export function Modal({
  title,
  onClose,
  children,
  closeLabel,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  closeLabel: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-root" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="modal-backdrop" aria-label={closeLabel} onClick={onClose} />
      <div className="modal-panel">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl leading-tight">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={closeLabel}>
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PinPad({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  return (
    <div>
      <div className="mb-4 flex justify-center gap-2" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={cn("pin-dot", i < value.length && "pin-dot-on")} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {digits.slice(0, 9).map((d) => (
          <button key={d} type="button" className="pin-key" onClick={() => onChange((value + d).slice(0, 6))}>
            {d}
          </button>
        ))}
        <span />
        <button type="button" className="pin-key" onClick={() => onChange((value + "0").slice(0, 6))}>
          0
        </button>
        <button type="button" className="pin-key" onClick={() => onChange(value.slice(0, -1))} aria-label="⌫">
          ⌫
        </button>
      </div>
    </div>
  );
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <div className="card text-center">
      <p className="font-display text-2xl">{title}</p>
      {body ? <p className="mt-2 text-muted">{body}</p> : null}
    </div>
  );
}
