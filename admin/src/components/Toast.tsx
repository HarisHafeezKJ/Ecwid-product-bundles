import { useEffect, useRef, useState } from 'react';

interface ToastProps {
  message: string;
  onClose: () => void;
  durationMs?: number;
  error?: boolean;
}

export default function Toast({ message, onClose, durationMs = 4000, error = false }: ToastProps) {
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(durationMs);
  const lastTickRef = useRef(Date.now());
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (paused) {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    lastTickRef.current = Date.now();
    timerRef.current = window.setTimeout(() => {
      onClose();
    }, remainingRef.current);

    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, [paused, onClose]);

  const handleMouseEnter = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
      remainingRef.current -= Date.now() - lastTickRef.current;
    }
    setPaused(true);
  };

  const handleMouseLeave = () => {
    setPaused(false);
  };

  return (
    <div
      className={`toast${error ? ' error' : ''}`}
      role="status"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span>{message}</span>
      <button type="button" className="toast-close" onClick={onClose} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
