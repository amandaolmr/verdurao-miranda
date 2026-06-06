import { useCallback, useEffect, useRef, useState } from "react";
import {
  type QZStatus,
  connectQZ,
  disconnectQZ,
  isQZConnected,
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
  /** Name of the default printer found after connecting (null if not yet connected). */
  printerName: string | null;
  /** Open the WebSocket connection to QZ Tray and discover the default printer. */
  connect: () => Promise<void>;
  /** Close the WebSocket connection. */
  disconnect: () => Promise<void>;
  /**
   * Print a full ESC/POS receipt for the given order.
   * Throws if QZ Tray is not connected.
   */
  print: (
    order: any,
    nomeLoja: string,
    whatsapp?: string | null,
  ) => Promise<void>;
  /**
   * Print a test page to verify that the printer is working.
   * Throws if QZ Tray is not connected.
   */
  testPrint: (nomeLoja: string) => Promise<void>;
}

export function useQZTray(): UseQZTrayReturn {
  const [status, setStatus] = useState<QZStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [printerName, setPrinterName] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    // Check if QZ Tray is already active (e.g. after a hot-reload).
    if (isQZConnected()) setStatus("connected");
    return () => {
      mounted.current = false;
    };
  }, []);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    try {
      const printer = await connectQZ();
      if (mounted.current) {
        setStatus("connected");
        setPrinterName(printer);
      }
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
      if (mounted.current) {
        setStatus("disconnected");
        setPrinterName(null);
      }
    }
  }, []);

  const print = useCallback(
    async (order: any, nomeLoja: string, whatsapp?: string | null) => {
      if (!isQZConnected()) throw new Error("QZ Tray não está conectado.");
      await printOrder(order, nomeLoja, whatsapp);
    },
    [],
  );

  const testPrint = useCallback(
    async (nomeLoja: string) => {
      if (!isQZConnected()) throw new Error("QZ Tray não está conectado.");
      await printTestPage(nomeLoja, printerName ?? undefined);
    },
    [printerName],
  );

  return {
    status,
    error,
    isConnected: status === "connected",
    printerName,
    connect,
    disconnect,
    print,
    testPrint,
  };
}
