import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';

const WS_URL = Platform.OS === 'android'
  ? 'ws://10.0.2.2:3000/ws'
  : 'ws://localhost:3000/ws';

type ProductUpdateHandler = (event: {
  type: string;
  productId?: string;
  shopId?: string;
  [key: string]: any;
}) => void;

export function useProductSocket(onUpdate: ProductUpdateHandler) {
  const wsRef    = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type === 'product_updated') {
          onUpdate(event);
        }
      } catch {}
    };

    ws.onclose = () => {
      // Auto-reconnect after 2 s if still mounted
      if (mountedRef.current) {
        timerRef.current = setTimeout(connect, 2000);
      }
    };

    ws.onerror = () => ws.close();
  }, [onUpdate]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);
}
