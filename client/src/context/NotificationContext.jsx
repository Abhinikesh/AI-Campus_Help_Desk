/**
 * client/src/context/NotificationContext.jsx
 * Centralized Notification Provider with Real-time SSE Push & Polling Fallback.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import notificationService from '../services/notification.service';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const { showToast } = useToast() || {};
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const eventSourceRef = useRef(null);

  // Fetch unread count & top 5 recent notifications
  const refreshUnread = useCallback(async () => {
    if (!user) return;
    try {
      const [countRes, recentRes] = await Promise.all([
        notificationService.getUnreadCount(),
        notificationService.getNotifications({ limit: 5 }),
      ]);
      setUnreadCount(countRes.data?.unreadCount || 0);
      setRecentNotifications(recentRes.data || []);
    } catch (err) {
      // Gracefully handle network glitches without breaking UI
    }
  }, [user]);

  // Mark single notification as read
  const markAsRead = useCallback(async (id) => {
    try {
      setRecentNotifications(prev =>
        prev.map(n => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      await notificationService.markAsRead(id);
    } catch (err) {
      refreshUnread();
    }
  }, [refreshUnread]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      setRecentNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      await notificationService.markAllAsRead();
    } catch (err) {
      refreshUnread();
    }
  }, [refreshUnread]);

  // Delete notification
  const deleteNotification = useCallback(async (id) => {
    try {
      const target = recentNotifications.find(n => n._id === id);
      if (target && !target.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      setRecentNotifications(prev => prev.filter(n => n._id !== id));
      await notificationService.deleteNotification(id);
    } catch (err) {
      refreshUnread();
    }
  }, [recentNotifications, refreshUnread]);

  // Real-time SSE Connection & Polling Fallback
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setRecentNotifications([]);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    refreshUnread();

    let isCancelled = false;
    let abortController = new AbortController();
    let reconnectTimeout = null;

    // Fetch-based SSE streaming with Authorization header & cookie credentials (no URL query token)
    async function startStream() {
      const token = localStorage.getItem('campus_token');
      if (!token || isCancelled) return;

      try {
        const response = await fetch('/api/notifications/stream', {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
          credentials: 'include',
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`SSE stream connection failed with status ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!isCancelled) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const block of parts) {
            if (!block.trim() || block.startsWith(':')) continue; // Skip comments and ping heartbeats
            const lines = block.split('\n');
            let eventType = 'message';
            let dataStr = '';

            for (const line of lines) {
              if (line.startsWith('event: ')) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith('data: ')) {
                dataStr = line.slice(6).trim();
              }
            }

            if (eventType === 'notification' && dataStr) {
              try {
                const newNotif = JSON.parse(dataStr);
                setRecentNotifications(prev => [newNotif, ...prev.slice(0, 4)]);
                setUnreadCount(prev => prev + 1);

                if (showToast) {
                  showToast(`${newNotif.title}: ${newNotif.message}`, 'info');
                }
              } catch (_) {}
            } else if (eventType === 'unread_count' && dataStr) {
              try {
                const data = JSON.parse(dataStr);
                if (typeof data.unreadCount === 'number') {
                  setUnreadCount(data.unreadCount);
                }
              } catch (_) {}
            } else if (eventType === 'auth_expired') {
              refreshUnread();
            }
          }
        }
      } catch (err) {
        if (!isCancelled && err.name !== 'AbortError') {
          // Reconnect with 5-second backoff
          reconnectTimeout = setTimeout(startStream, 5000);
        }
      }
    }

    startStream();

    // Secondary background polling every 30 seconds for maximum reliability
    const interval = setInterval(refreshUnread, 30000);

    // Refresh when tab regains focus
    const handleFocus = () => refreshUnread();
    window.addEventListener('focus', handleFocus);

    return () => {
      isCancelled = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      abortController.abort();
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, refreshUnread, showToast]);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        recentNotifications,
        loading,
        refreshUnread,
        markAsRead,
        markAllAsRead,
        deleteNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    return {
      unreadCount: 0,
      recentNotifications: [],
      loading: false,
      refreshUnread: () => {},
      markAsRead: () => {},
      markAllAsRead: () => {},
      deleteNotification: () => {},
    };
  }
  return context;
};

export default NotificationContext;

