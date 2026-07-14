"use client";

import React, { createContext, useContext, useState } from "react";
import AuthOverlay, { AuthMode } from "@/components/customer/AuthOverlay";

interface AuthModalContextType {
  openAuth: (mode: AuthMode) => void;
  closeAuth: () => void;
}

const AuthModalContext = createContext<AuthModalContextType | undefined>(undefined);

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);

  const openAuth = (mode: AuthMode) => setAuthMode(mode);
  const closeAuth = () => setAuthMode(null);

  const handleSuccess = () => {
    closeAuth();
    window.location.reload();
  };

  return (
    <AuthModalContext.Provider value={{ openAuth, closeAuth }}>
      {children}
      {authMode && (
        <AuthOverlay
          mode={authMode}
          onModeChange={setAuthMode}
          onSuccess={handleSuccess}
          onClose={closeAuth}
        />
      )}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const context = useContext(AuthModalContext);
  if (context === undefined) {
    throw new Error("useAuthModal must be used within an AuthModalProvider");
  }
  return context;
}
