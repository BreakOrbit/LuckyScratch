"use client";

import { createContext, startTransition, useCallback, useContext, useRef, useState } from "react";
import { generateTicketKeypair, loadRelayerSDK } from "./sdk";
import type { TicketKeypair } from "./types";

type TicketSession = {
  keypair: TicketKeypair;
  createdAt: number;
};

type FhevmRuntimeStatus = "idle" | "loading" | "ready" | "error";

type FhevmRuntimeContextValue = {
  status: FhevmRuntimeStatus;
  error: string | null;
  ensureReady: () => Promise<void>;
  getOrCreateTicketKeypair: (ticketId: string) => Promise<TicketKeypair>;
  clearTicketSession: (ticketId: string) => void;
};

const FhevmRuntimeContext = createContext<FhevmRuntimeContextValue | null>(null);

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return "unknown FHE runtime error";
};

export const FhevmRuntimeProvider = ({ children }: { children: React.ReactNode }) => {
  const sessionsRef = useRef<Record<string, TicketSession>>({});
  const [status, setStatus] = useState<FhevmRuntimeStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const ensureReady = useCallback(async () => {
    try {
      startTransition(() => {
        setStatus(current => (current === "ready" ? current : "loading"));
        setError(null);
      });
      await loadRelayerSDK();
      startTransition(() => {
        setStatus("ready");
        setError(null);
      });
    } catch (error) {
      startTransition(() => {
        setStatus("error");
        setError(toErrorMessage(error));
      });
      throw error;
    }
  }, []);

  const getOrCreateTicketKeypair = useCallback(
    async (ticketId: string) => {
      const existing = sessionsRef.current[ticketId];
      if (existing) {
        return existing.keypair;
      }

      await ensureReady();
      const keypair = await generateTicketKeypair();
      sessionsRef.current[ticketId] = {
        keypair,
        createdAt: Date.now(),
      };
      return keypair;
    },
    [ensureReady],
  );

  const clearTicketSession = useCallback((ticketId: string) => {
    delete sessionsRef.current[ticketId];
  }, []);

  return (
    <FhevmRuntimeContext.Provider value={{ status, error, ensureReady, getOrCreateTicketKeypair, clearTicketSession }}>
      {children}
    </FhevmRuntimeContext.Provider>
  );
};

export const useFhevmRuntime = () => {
  const context = useContext(FhevmRuntimeContext);
  if (!context) {
    throw new Error("useFhevmRuntime must be used inside FhevmRuntimeProvider");
  }
  return context;
};
