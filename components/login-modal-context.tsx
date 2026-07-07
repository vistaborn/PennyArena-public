"use client";

import React, { createContext, useContext, useState } from "react";
import { LoginModal } from "@/components/login-modal";

type LoginModalContextType = {
  showLogin: () => void;
  hideLogin: () => void;
};

const LoginModalContext = createContext<LoginModalContextType | null>(null);

export function LoginModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <LoginModalContext.Provider
      value={{ showLogin: () => setOpen(true), hideLogin: () => setOpen(false) }}
    >
      {children}
      <LoginModal open={open} onClose={() => setOpen(false)} />
    </LoginModalContext.Provider>
  );
}

export function useLoginModal() {
  const ctx = useContext(LoginModalContext);
  if (!ctx) throw new Error("useLoginModal must be used within LoginModalProvider");
  return ctx;
}
