import { useEffect, useState } from 'react';

/** useState kept in this browser's localStorage. Falls back to `initial` when storage is off or the stored value fails `valid`. */
export function usePersisted<T>(key: string, initial: T, valid: (v: unknown) => boolean = () => true) {
  const [value, setValue] = useState<T>(() => {
    try {
      const s = localStorage.getItem(key);
      const v: unknown = s == null ? initial : JSON.parse(s);
      return valid(v) ? (v as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage off: this session only */ }
  }, [key, value]);
  return [value, setValue] as const;
}
