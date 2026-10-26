'use client';

import { useEffect } from 'react';

export function ErrorSuppressor() {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Prevent synthetic DOM Events, font loading errors, or WebSocket reconnection events from surfacing as uncaught errors
      if (
        event.reason instanceof Event ||
        (event.reason && (event.reason.toString() === '[object Event]' || event.reason.name === 'SecurityError'))
      ) {
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
