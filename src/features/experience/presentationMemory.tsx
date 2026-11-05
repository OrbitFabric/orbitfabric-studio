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
  const [state, setState] = useState<{key:string;value:T}>(() => ({key,value:memory.has(key)?memory.get(key) as T:initial}));
  const value = state.key === key ? state.value : memory.has(key) ? memory.get(key) as T : initial;
  return [value, next => setState(previous => {
    const base = previous.key === key ? previous.value : memory.has(key) ? memory.get(key) as T : initial;
    const result = typeof next === 'function' ? (next as (v:T)=>T)(base) : next;
    memory.set(key,result);
    return {key,value:result};
  })];
}
