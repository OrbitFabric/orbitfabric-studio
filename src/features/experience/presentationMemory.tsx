import {
  createContext,
  useContext,
  useState,
  type SetStateAction,
} from "react";
// App owns this ephemeral map per Mission generation. It contains presentation only.
export const PresentationMemory = createContext<Map<string, unknown>>(
  new Map(),
);
export function usePresentationMemory<T>(
  key: string,
  initial: T,
): [T, (next: SetStateAction<T>) => void] {
  const memory = useContext(PresentationMemory);
  const [value, setValue] = useState<T>(() =>
    memory.has(key) ? (memory.get(key) as T) : initial,
  );
  return [
    value,
    (next) =>
      setValue((previous) => {
        const result =
          typeof next === "function" ? (next as (v: T) => T)(previous) : next;
        memory.set(key, result);
        return result;
      }),
  ];
}
