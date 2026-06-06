/**
 * Minimal TypeScript declarations for the qz-tray npm package (v2.2.x).
 * The package ships as CommonJS without bundled types.
 */
declare module "qz-tray" {
  interface QZWebSocket {
    connect(opts?: {
      retries?: number;
      delay?: number;
      host?: string;
      usingSecure?: boolean;
    }): Promise<void>;
    disconnect(): Promise<void>;
    isActive(): boolean;
    getHost(): string;
    getPort(): number;
  }

  interface QZPrinters {
    /** Returns the name of the default printer. */
    getDefault(): Promise<string>;
    /** Returns a single printer name or an array when query matches multiple. */
    find(query?: string): Promise<string | string[]>;
  }

  interface QZConfig {
    // opaque config object returned by qz.configs.create()
  }

  interface QZRawData {
    type: "raw" | "pixel" | "html";
    format: "plain" | "base64" | "hex" | "file" | "xml";
    data: string;
    options?: Record<string, unknown>;
  }

  interface QZSecurity {
    setCertificatePromise(
      fn: (resolve: (cert: string) => void, reject: (err: unknown) => void) => void,
    ): void;
    setSignatureAlgorithm(alg: string): void;
    setSignaturePromise(
      fn: (
        toSign: string,
      ) => (resolve: (sig: string) => void, reject: (err: unknown) => void) => void,
    ): void;
  }

  interface QZConfigs {
    create(printer: string, options?: Record<string, unknown>): QZConfig;
  }

  interface QZ {
    websocket: QZWebSocket;
    printers: QZPrinters;
    configs: QZConfigs;
    security: QZSecurity;
    print(config: QZConfig, data: QZRawData[]): Promise<void>;
  }

  const qz: QZ;
  export default qz;
}
