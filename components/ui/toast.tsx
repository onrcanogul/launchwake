"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "@/components/Icon";

export type ToastKind = "success" | "error" | "info";
type Toast = { id: number; message: string; kind: ToastKind };
type ToastApi = { toast: (message: string, kind?: ToastKind) => void };

const ToastContext = createContext<ToastApi | null>(null);

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = ++seq;
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      kind === "error" ? 4000 : 2600,
    );
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="toaster"
        role="region"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.kind === "success" ? (
              <Icon name="check" />
            ) : (
              <span
                className="dot"
                style={{
                  background: t.kind === "error" ? "var(--bad)" : "var(--ac)",
                }}
              />
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Returns a toast() function. No-ops safely if used outside the provider. */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? { toast: () => {} };
}
