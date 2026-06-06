import { useCallback, useEffect, useRef, useState } from "react";
import {
  type QZStatus,
  connectQZ,
  disconnectQZ,
  isQZConnected,
  loadQZScript,
  printOrder,
  printTestPage,
} from "@/lib/qzTray";

export type { QZStatus };

export interface UseQZTrayReturn {
  /** Current connection status. */
  status: QZStatus;
  /** Last error message, if any. */
  error: string | null;
  /** True when status === "connected". */
  isConnected: boolean;
  /** Load the QZ Tray script and open the WebSocket connection. */
  connect: () => Promise<void>;
  /** Close the WebSocket connection. */
  disconnect: () => Promise<void>;
  /**
   * Print a full ESC/POS receipt for the given order.
   * Throws if QZ Tray is not connected.
   */
  print: (order: any, nomeLoja: string, whatsapp?: string | null) => Promise<void>;
  /**
   * Print a test page to verify that the printer is working.
   * Throws if QZ Tray is not connected.
   */
  testPrint: (nomeLoja: string) => Promise<void>;
}

export function useQZTray(): UseQZTrayReturn {
  const [status, setStatus] = useState<QZStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    // Pre-load the QZ Tray script on mount so the first "connect" call is fast.
    // If the script is already loaded (page reload), also update status.
    loadQZScript()
      .then(() => {
        if (!mounted.current) return;
        setStatus(isQZConnected() ? "connected" : "disconnected");
      })
      .catch(() => {
        // CDN may not be reachable — remain "idle" so the user can retry.
        if (mounted.current) setStatus("idle");
      });

    return () => {
      mounted.current = false;
    };
  }, []);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    try {
      await connectQZ();
      if (mounted.current) setStatus("connected");
    } catch (err) {
      if (mounted.current) {
        setStatus("error");
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await disconnectQZ();
    } finally {
      if (mounted.current) setStatus("disconnected");
    }
  }, []);

  const print = useCallback(async (order: any, nomeLoja: string, whatsapp?: string | null) => {
    if (!isQZConnected()) throw new Error("QZ Tray não está conectado.");
    await printOrder(order, nomeLoja, whatsapp);
  }, []);

  const testPrint = useCallback(async (nomeLoja: string) => {
    if (!isQZConnected()) throw new Error("QZ Tray não está conectado.");
    await printTestPage(nomeLoja);
  }, []);

  return {
    status,
    error,
    isConnected: status === "connected",
    connect,
    disconnect,
    print,
    testPrint,
  };
}
