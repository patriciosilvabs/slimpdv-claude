import { useState, useEffect, useCallback, useRef } from 'react';
import type { ConnectionStatus } from './useQzTray';

// SlimPrint protocol message
interface SlimPrintMessage {
  type: string;
  requestId: string;
  token?: string;
  payload: Record<string, unknown>;
}

// SlimPrint protocol response
interface SlimPrintResponse {
  requestId: string;
  status: 'success' | 'error';
  payload?: Record<string, unknown>;
  error?: { code: string; message: string };
}

// Pending request tracker
interface PendingRequest {
  resolve: (res: SlimPrintResponse) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RECONNECT_DELAY_MS = 13_000;
const MAX_RECONNECT_ATTEMPTS = 6;

// Fibonacci-like delay sequence: 1s, 2s, 3s, 5s, 8s, 13s
const FIBONACCI_DELAYS = [1000, 2000, 3000, 5000, 8000, 13000];
function fibonacciDelay(attempt: number): number {
  return Math.min(FIBONACCI_DELAYS[attempt - 1] || 13000, MAX_RECONNECT_DELAY_MS);
}
const EXHAUSTED_COOLDOWN_MS = 60_000; // Wait 1 min before allowing auto-reconnect after exhaustion
const EXHAUSTED_STORAGE_KEY = 'slimprint-exhausted-at';

function readExhaustedAt(): number {
  if (typeof window === 'undefined') return 0;

  const storedValue = Number(window.localStorage.getItem(EXHAUSTED_STORAGE_KEY) || '0');
  return Number.isFinite(storedValue) ? storedValue : 0;
}

function persistExhaustedAt(value: number) {
  if (typeof window === 'undefined') return;

  if (value > 0) {
    window.localStorage.setItem(EXHAUSTED_STORAGE_KEY, String(value));
    return;
  }

  window.localStorage.removeItem(EXHAUSTED_STORAGE_KEY);
}

let requestCounter = 0;
function nextRequestId(): string {
  return `sp_${Date.now()}_${++requestCounter}`;
}


export interface UseSlimPrintOptions {
  url: string;
  token: string;
  autoConnect?: boolean;
}

export function useSlimPrint({ url, token, autoConnect = false }: UseSlimPrintOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [printers, setPrinters] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map());
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnectRef = useRef(false);
  const isAuthenticatedRef = useRef(false);
  const isConnectedRef = useRef(false);
  const isConnectingRef = useRef(false);
  const exhaustedAtRef = useRef<number>(readExhaustedAt());
  const urlRef = useRef(url);
  const tokenRef = useRef(token);

  const setConnectedState = useCallback((value: boolean) => {
    isConnectedRef.current = value;
    setIsConnected(value);
  }, []);

  const setConnectingState = useCallback((value: boolean) => {
    isConnectingRef.current = value;
    setIsConnecting(value);
  }, []);

  // Keep refs in sync
  urlRef.current = url;
  tokenRef.current = token;

  const connectionStatus: ConnectionStatus = isConnected
    ? 'connected'
    : isConnecting
      ? 'connecting'
      : 'disconnected';

  // ── helpers ──────────────────────────────────────────────

  const send = useCallback((msg: SlimPrintMessage): Promise<SlimPrintResponse> => {
    return new Promise((resolve, reject) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('SlimPrint não está conectado'));
        return;
      }
      const timer = setTimeout(() => {
        pendingRef.current.delete(msg.requestId);
        reject(new Error('Timeout: SlimPrint não respondeu'));
      }, REQUEST_TIMEOUT_MS);

      pendingRef.current.set(msg.requestId, { resolve, reject, timer });
      ws.send(JSON.stringify(msg));
    });
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data: SlimPrintResponse = JSON.parse(event.data);
      const pending = pendingRef.current.get(data.requestId);
      if (pending) {
        clearTimeout(pending.timer);
        pendingRef.current.delete(data.requestId);
        if (data.status === 'error') {
          pending.reject(new Error(data.error?.message || 'Erro desconhecido do SlimPrint'));
        } else {
          pending.resolve(data);
        }
      }
    } catch {
      console.warn('[SlimPrint] Mensagem não-JSON recebida');
    }
  }, []);

  const waitForConnection = useCallback((): Promise<boolean> => {
    if (wsRef.current?.readyState === WebSocket.OPEN || isConnectedRef.current) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN || isConnectedRef.current) {
          clearInterval(check);
          clearTimeout(timeoutId);
          resolve(true);
        }
      }, 100);

      const timeoutId = setTimeout(() => {
        clearInterval(check);
        resolve(wsRef.current?.readyState === WebSocket.OPEN || isConnectedRef.current);
      }, 5000);
    });
  }, []);

  // ── connection ───────────────────────────────────────────

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!shouldReconnectRef.current) return;
    const attempt = ++reconnectAttemptRef.current;
    if (attempt > MAX_RECONNECT_ATTEMPTS) {
      console.log(`[SlimPrint] Máximo de tentativas (${MAX_RECONNECT_ATTEMPTS}) atingido. Reconexão parada.`);
      shouldReconnectRef.current = false;
      exhaustedAtRef.current = Date.now();
      persistExhaustedAt(exhaustedAtRef.current);
      setError('Não foi possível conectar ao SlimPrint após várias tentativas');
      return;
    }
    const delay = fibonacciDelay(attempt);
    console.log(`[SlimPrint] Reconexão em ${delay}ms (tentativa ${attempt}/${MAX_RECONNECT_ATTEMPTS})`);
    reconnectTimerRef.current = setTimeout(() => {
      connectInternal();
    }, delay);
  }, []);

  const connectInternal = useCallback(() => {
    const currentSocket = wsRef.current;

    if (
      currentSocket?.readyState === WebSocket.OPEN ||
      currentSocket?.readyState === WebSocket.CONNECTING ||
      isConnectingRef.current
    ) {
      return;
    }

    clearReconnectTimer();

    if (currentSocket) {
      currentSocket.onclose = null;
      currentSocket.onerror = null;
      currentSocket.onmessage = null;
      currentSocket.onopen = null;
      try { currentSocket.close(); } catch {}
      wsRef.current = null;
    }

    setConnectingState(true);
    setError(null);
    isAuthenticatedRef.current = false;

    try {
      const ws = new WebSocket(urlRef.current);
      wsRef.current = ws;

      ws.onopen = async () => {
        if (wsRef.current !== ws) return;

        console.log('[SlimPrint] WebSocket conectado');
        reconnectAttemptRef.current = 0;
        exhaustedAtRef.current = 0;
        persistExhaustedAt(0);

        if (tokenRef.current) {
          try {
            const reqId = nextRequestId();
            const authMsg: SlimPrintMessage = {
              type: 'auth',
              requestId: reqId,
              token: tokenRef.current,
              payload: {},
            };

            ws.onmessage = handleMessage;
            const res = await send(authMsg);
            if (wsRef.current !== ws) return;

            if (res.status === 'success') {
              isAuthenticatedRef.current = true;
              console.log('[SlimPrint] Autenticado com sucesso');
            }
          } catch (err: any) {
            console.error('[SlimPrint] Falha na autenticação:', err?.message);
            setError(`Falha na autenticação: ${err?.message}`);
          }
        }

        setConnectedState(true);
        setConnectingState(false);
      };

      ws.onmessage = handleMessage;

      ws.onerror = () => {
        if (wsRef.current !== ws) return;
        // Error detail will be set in onclose with code analysis
      };

      ws.onclose = (event) => {
        if (wsRef.current !== ws) return;

        const wasEverOpen = isAuthenticatedRef.current || isConnectedRef.current;

        console.log(`[SlimPrint] WebSocket desconectado (code=${event.code}, wasOpen=${wasEverOpen})`);
        wsRef.current = null;
        setConnectedState(false);
        setConnectingState(false);
        isAuthenticatedRef.current = false;

        // Code 1006 = abnormal closure (cert rejected, origin blocked, or service down)
        if (!wasEverOpen && event.code === 1006) {
          setError(
            'Conexão recusada. Verifique: 1) SlimPrint está rodando, ' +
            '2) Certificado aceito (abra https://127.0.0.1:9415 no navegador), ' +
            '3) Origem do site está nas origens permitidas do SlimPrint'
          );
        } else if (!wasEverOpen) {
          setError('Erro de conexão com SlimPrint');
        }

        for (const [, p] of pendingRef.current) {
          clearTimeout(p.timer);
          p.reject(new Error('Conexão fechada'));
        }
        pendingRef.current.clear();

        scheduleReconnect();
      };
    } catch (err: any) {
      setError(`Falha ao conectar: ${err?.message}`);
      setConnectingState(false);
      scheduleReconnect();
    }
  }, [clearReconnectTimer, handleMessage, scheduleReconnect, send, setConnectedState, setConnectingState]);

  const connect = useCallback(async (force = false): Promise<boolean> => {
    // If max attempts were recently exhausted, skip unless forced (user-initiated)
    if (!force && exhaustedAtRef.current > 0) {
      const elapsed = Date.now() - exhaustedAtRef.current;
      if (elapsed < EXHAUSTED_COOLDOWN_MS) {
        console.log(`[SlimPrint] Cooldown ativo (${Math.round((EXHAUSTED_COOLDOWN_MS - elapsed) / 1000)}s restantes). Use connect(true) para forçar.`);
        return false;
      }
      // Cooldown expired, allow retry
      exhaustedAtRef.current = 0;
      persistExhaustedAt(0);
    }

    // For forced (manual) connects, only try once — don't enable auto-reconnect loop
    shouldReconnectRef.current = !force;

    if (wsRef.current?.readyState === WebSocket.OPEN || isConnectedRef.current) {
      return true;
    }

    if (wsRef.current?.readyState !== WebSocket.CONNECTING && !isConnectingRef.current) {
      clearReconnectTimer();
      reconnectAttemptRef.current = 0;
      exhaustedAtRef.current = 0;
      persistExhaustedAt(0);
      connectInternal();
    }

    return waitForConnection();
  }, [clearReconnectTimer, connectInternal, waitForConnection]);

  const disconnect = useCallback(async () => {
    shouldReconnectRef.current = false;
    clearReconnectTimer();
    reconnectAttemptRef.current = 0;
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectedState(false);
    setConnectingState(false);
    setPrinters([]);
    isAuthenticatedRef.current = false;
  }, [clearReconnectTimer, setConnectedState, setConnectingState]);

  // ── API methods ──────────────────────────────────────────

  const ping = useCallback(async (): Promise<boolean> => {
    try {
      const res = await send({
        type: 'ping',
        requestId: nextRequestId(),
        payload: {},
      });
      return res.status === 'success';
    } catch {
      return false;
    }
  }, [send]);

  const listPrinters = useCallback(async (): Promise<string[]> => {
    try {
      const res = await send({
        type: 'list_printers',
        requestId: nextRequestId(),
        token: tokenRef.current,
        payload: {},
      });
      const raw = (res.payload?.printers as Array<string | { name: string }>) || [];
      const list = raw.map((p) => (typeof p === 'string' ? p : p.name));
      setPrinters(list);
      return list;
    } catch (err: any) {
      setError(`Erro ao listar impressoras: ${err?.message}`);
      return [];
    }
  }, [send]);

  const refreshPrinters = listPrinters;

  const printRaw = useCallback(async (
    printerName: string,
    data: string,
    encoding: string = 'base64'
  ): Promise<boolean> => {
    try {
      const res = await send({
        type: 'print_raw',
        requestId: nextRequestId(),
        token: tokenRef.current,
        payload: { printerName, data, encoding },
      });
      return res.status === 'success';
    } catch (err: any) {
      throw new Error(`Erro ao imprimir: ${err?.message}`);
    }
  }, [send]);

  const printTest = useCallback(async (kind: 'escpos' | 'zpl', printerName: string): Promise<boolean> => {
    try {
      const res = await send({
        type: 'print_test',
        requestId: nextRequestId(),
        token: tokenRef.current,
        payload: { kind, printerName },
      });
      return res.status === 'success';
    } catch (err: any) {
      throw new Error(`Erro no teste: ${err?.message}`);
    }
  }, [send]);

  const getStatus = useCallback(async (): Promise<Record<string, unknown> | null> => {
    try {
      const res = await send({
        type: 'get_status',
        requestId: nextRequestId(),
        token: tokenRef.current,
        payload: {},
      });
      return res.payload || null;
    } catch {
      return null;
    }
  }, [send]);

  // High-level print compatible with QZ Tray interface:
  // Accepts ESC/POS string, converts to base64, sends via print_raw
  const print = useCallback(async (
    printerName: string | null,
    data: string | any[],
    _isRaw = true
  ): Promise<boolean> => {
    if (!printerName) throw new Error('Nenhuma impressora selecionada');

    // Flatten mixed arrays to single string (SlimPrint doesn't support image objects)
    let rawString: string;
    if (Array.isArray(data)) {
      rawString = data
        .filter((item) => typeof item === 'string')
        .join('');
    } else {
      rawString = data;
    }

    // Convert to base64
    const base64Data = btoa(
      rawString.split('').map((c) => String.fromCharCode(c.charCodeAt(0) & 0xff)).join('')
    );

    return printRaw(printerName, base64Data, 'base64');
  }, [printRaw]);

  // QZ Tray compatible test print
  const testPrintCompat = useCallback(async (printerName: string): Promise<boolean> => {
    return printTest('escpos', printerName);
  }, [printTest]);

  // Auto-connect on mount if requested
  useEffect(() => {
    if (autoConnect && url && token) {
      shouldReconnectRef.current = true;
      connectInternal();
    }
    return () => {
      shouldReconnectRef.current = false;
      clearReconnectTimer();
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // State
    isConnected,
    isConnecting,
    connectionStatus,
    printers,
    error,
    // Connection
    connect,
    disconnect,
    // API
    ping,
    listPrinters,
    refreshPrinters,
    printRaw,
    printTest,
    getStatus,
    // QZ Tray compatible
    print,
    testPrint: testPrintCompat,
  };
}
