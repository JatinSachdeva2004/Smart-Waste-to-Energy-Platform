"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface WebSocketMessage {
  type: string;
  data?: any;
}

interface UseWebSocketOptions {
  onMessage?: (msg: WebSocketMessage) => void;
  reconnectInterval?: number;
  maxRetries?: number;
}

export function useWebSocket(url: string, options: UseWebSocketOptions = {}) {
  const { onMessage, reconnectInterval = 3000, maxRetries = 5 } = options;
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        retriesRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const msg: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(msg);
          onMessageRef.current?.(msg);
        } catch {
          // Non-JSON message
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (retriesRef.current < maxRetries) {
          retriesRef.current++;
          setTimeout(connect, reconnectInterval);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // Connection failed
    }
  }, [url, reconnectInterval, maxRetries]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { connected, lastMessage, send };
}
