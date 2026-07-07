"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

type ToastKind = "success" | "error";

type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
};

type ToastContextType = {
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, kind === "error" ? 6000 : 3500);
  }, []);

  const dismiss = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider
      value={{
        success: (m) => push("success", m),
        error: (m) => push("error", m),
      }}
    >
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`} role="status">
            {t.kind === "success" ? (
              <CheckCircle2 size={18} className="shrink-0 text-penny-mint" />
            ) : (
              <XCircle size={18} className="shrink-0 text-penny-coral" />
            )}
            <p className="flex-1 text-sm leading-snug">{t.message}</p>
            <button
              type="button"
              className="toast-dismiss"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
