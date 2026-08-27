import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * useWebSocket - هوک سفارشی برای اتصال WebSocket به قیمت‌های لحظه‌ای
 *
 * @param {Object} options
 * @param {string} [options.url] - آدرس WebSocket (پیش‌فرض از env یا /ws/prices)
 * @param {Function} [options.onMessage] - کال‌بک دریافت پیام
 * @param {Function} [options.onOpen] - کال‌بک اتصال موفق
 * @param {Function} [options.onError] - کال‌بک خطا
 * @param {Function} [options.onClose] - کال‌بک قطع اتصال
 * @param {boolean} [options.autoConnect=true] - اتصال خودکار
 * @param {number} [options.reconnectDelay=3000] - تاخیر اتصال مجدد (میلی‌ثانیه)
 * @param {number} [options.maxReconnectAttempts=10] - حداکثر تلاش اتصال مجدد
 * @param {boolean} [options.enabled=true] - فعال/غیرفعال کردن اتصال
 *
 * @returns {Object} {
 *   isConnected,  - وضعیت اتصال
 *   isReconnecting, - در حال اتصال مجدد
 *   lastMessage, - آخرین پیام دریافتی
 *   reconnectAttempts, - تعداد تلاش‌های اتصال مجدد
 *   sendMessage, - ارسال پیام
 *   connect, - اتصال دستی
 *   disconnect, - قطع اتصال دستی
 * }
 */
export default function useWebSocket({
  url,
  onMessage,
  onOpen,
  onError,
  onClose,
  autoConnect = true,
  reconnectDelay = 3000,
  maxReconnectAttempts = 10,
  enabled = true,
} = {}) {
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);
  const isManualCloseRef = useRef(false);
  const connectWsRef = useRef(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // رفرنس‌های پایدار برای کال‌بک‌ها
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onErrorRef = useRef(onError);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onOpenRef.current = onOpen; }, [onOpen]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  /**
   * تعیین آدرس WebSocket
   */
  const getWsUrl = useCallback(() => {
    if (url) return url;

    // بررسی متغیر محیطی
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_URL) {
      return import.meta.env.VITE_WS_URL;
    }

    // ساخت آدرس بر اساس آدرس صفحه
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws/prices`;
  }, [url]);

  /**
   * پاک کردن تایمر اتصال مجدد
   */
  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  /**
   * تلاش اتصال مجدد
   */
  const attemptReconnect = useCallback(() => {
    if (!isMountedRef.current || isManualCloseRef.current) return;
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      setIsReconnecting(false);
      console.warn(
        `[WebSocket] حداکثر تلاش اتصال مجدد (${maxReconnectAttempts}) به پایان رسید.`
      );
      return;
    }

    setIsReconnecting(true);
    reconnectAttemptsRef.current += 1;
    setReconnectAttempts(reconnectAttemptsRef.current);

    const delay = reconnectDelay * Math.min(reconnectAttemptsRef.current, 5);
    console.log(
      `[WebSocket] اتصال مجدد (تلاش ${reconnectAttemptsRef.current}) در ${delay}ms...`
    );

    reconnectTimerRef.current = setTimeout(() => {
      if (isMountedRef.current && !isManualCloseRef.current) {
        connectWsRef.current?.();
      }
    }, delay);
  }, [reconnectDelay, maxReconnectAttempts]);

  /**
   * اتصال WebSocket
   */
  const connectWs = useCallback(() => {
    // بستن اتصال قبلی
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.onopen = null;
      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        wsRef.current.close();
      }
    }

    isManualCloseRef.current = false;
    const wsUrl = getWsUrl();

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        console.log('[WebSocket] اتصال برقرار شد');
        setIsConnected(true);
        setIsReconnecting(false);
        reconnectAttemptsRef.current = 0;
        setReconnectAttempts(0);
        if (onOpenRef.current) onOpenRef.current();
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          if (onMessageRef.current) onMessageRef.current(data);
        } catch (err) {
          // اگر JSON نبود، داده خام ارسال شود
          setLastMessage(event.data);
          if (onMessageRef.current) onMessageRef.current(event.data);
        }
      };

      ws.onerror = (error) => {
        if (!isMountedRef.current) return;
        console.error('[WebSocket] خطا:', error);
        if (onErrorRef.current) onErrorRef.current(error);
      };

      ws.onclose = (event) => {
        if (!isMountedRef.current) return;
        console.log('[WebSocket] اتصال قطع شد', event.code, event.reason);
        setIsConnected(false);
        if (onCloseRef.current) onCloseRef.current(event);

        // اتصال مجدد خودکار (مگر بسته شده دستی باشد)
        if (!isManualCloseRef.current) {
          attemptReconnect();
        }
      };
    } catch (err) {
      console.error('[WebSocket] خطا در ایجاد اتصال:', err);
      if (!isManualCloseRef.current) {
        attemptReconnect();
      }
    }
  }, [getWsUrl, attemptReconnect]);
  connectWsRef.current = connectWs;

  /**
   * ارسال پیام
   */
  const sendMessage = useCallback((data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      wsRef.current.send(message);
      return true;
    }
    console.warn('[WebSocket] اتصال برقرار نیست. پیام ارسال نشد.');
    return false;
  }, []);

  /**
   * قطع اتصال دستی
   */
  const disconnect = useCallback(() => {
    isManualCloseRef.current = true;
    clearReconnectTimer();
    setIsReconnecting(false);
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close(1000, 'قطع اتصال دستی');
      wsRef.current = null;
    }
    setIsConnected(false);
  }, [clearReconnectTimer]);

  /**
   * اتصال دستی
   */
  const connect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);
    connectWs();
  }, [connectWs]);

  // اتصال خودکار در mount
  useEffect(() => {
    isMountedRef.current = true;

    if (enabled && autoConnect) {
      connectWs();
    }

    return () => {
      isMountedRef.current = false;
      clearReconnectTimer();
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        wsRef.current.onopen = null;
        wsRef.current.close(1000, 'کامپوننت unmount شد');
        wsRef.current = null;
      }
    };
  }, [enabled, autoConnect, connectWs, clearReconnectTimer]);

  return {
    isConnected,
    isReconnecting,
    lastMessage,
    reconnectAttempts,
    sendMessage,
    connect,
    disconnect,
  };
}
