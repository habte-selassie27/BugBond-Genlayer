import { useCallback, useEffect, useRef, useState } from "react";
import type { Batch } from "@/lib/scope-data";

export type ChainState = "LOADING" | "READY" | "EMPTY" | "RPC ERROR";

export function useChainData<T>(load: (onBatch?: Batch<T>) => Promise<T[]>, deps: React.DependencyList) {
  const [items, setItems] = useState<T[]>([]);
  const [state, setState] = useState<ChainState>("LOADING");
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const retry = useCallback(() => {
    setState("LOADING");
    setItems([]);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    // Partial pages stream in as each id page finishes, so the table fills in
    // while the remaining records are still being read.
    loadRef.current((rows) => {
      if (!alive) return;
      setItems(rows);
      setState("LOADING");
    })
      .then((rows) => {
        if (!alive) return;
        setItems(rows);
        setState(rows.length ? "READY" : "EMPTY");
      })
      .catch(() => {
        if (alive) setState("RPC ERROR");
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  return { items, state, retry };
}
