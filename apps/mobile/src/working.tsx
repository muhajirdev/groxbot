import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type WorkingMap = Record<string, boolean>;

const WorkingContext = createContext<{
  working: WorkingMap;
  setWorking: (botId: string, on: boolean) => void;
}>({
  working: {},
  setWorking: () => undefined,
});

export function WorkingProvider({ children }: { children: ReactNode }) {
  const [working, setMap] = useState<WorkingMap>({});
  const setWorking = useCallback((botId: string, on: boolean) => {
    setMap((prev) => {
      if (Boolean(prev[botId]) === on) return prev;
      return { ...prev, [botId]: on };
    });
  }, []);
  const value = useMemo(() => ({ working, setWorking }), [working, setWorking]);
  return (
    <WorkingContext.Provider value={value}>{children}</WorkingContext.Provider>
  );
}

export function useWorking(botId?: string): boolean {
  const { working } = useContext(WorkingContext);
  return botId ? Boolean(working[botId]) : false;
}

export function useSetWorking() {
  return useContext(WorkingContext).setWorking;
}
