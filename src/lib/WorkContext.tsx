import React, { createContext, useContext, useMemo, useRef } from 'react';

export type WorkContextKey = { projectId?: string; url?: string };

export interface EntitiesDraft {
  suggested?: Array<{ name: string; type?: string; relevance?: number; description?: string }>;
  missing?: Array<{ name: string; type?: string; importance?: string; reasoning?: string }>;
  accepted?: string[]; // store names for simplicity
  updatedAt?: string;
}

export interface WorkContextData {
  entities?: EntitiesDraft;
  // Future: schemaDraft, citations, voiceProfile, etc.
}

type KeyString = string; // projectId|url composite key

interface WorkContextAPI {
  get: (key: WorkContextKey) => WorkContextData | undefined;
  set: (key: WorkContextKey, data: Partial<WorkContextData>) => void;
  clear: (key: WorkContextKey) => void;
}

const WorkContext = createContext<WorkContextAPI | null>(null);

function makeKey({ projectId, url }: WorkContextKey): KeyString {
  return `${projectId || ''}::${url || ''}`;
}

export const WorkContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const storeRef = useRef(new Map<KeyString, WorkContextData>());

  const api = useMemo<WorkContextAPI>(() => ({
    get: (key) => storeRef.current.get(makeKey(key)),
    set: (key, data) => {
      const k = makeKey(key);
      const prev = storeRef.current.get(k) || {};
      storeRef.current.set(k, { ...prev, ...data });
    },
    clear: (key) => {
      storeRef.current.delete(makeKey(key));
    }
  }), []);

  return <WorkContext.Provider value={api}>{children}</WorkContext.Provider>;
};

export function useWorkContext(): WorkContextAPI {
  const ctx = useContext(WorkContext);
  if (!ctx) throw new Error('useWorkContext must be used within WorkContextProvider');
  return ctx;
}

