import React, { createContext, useContext, useMemo, useReducer } from 'react';
import type { AppState } from '../types/state.js';
import { initialAppState } from '../types/state.js';
import { appReducer } from './reducer.js';
import type { AppAction } from './actions.js';

export type AppDispatch = (action: AppAction) => void;

const StateContext = createContext<AppState | undefined>(undefined);
const DispatchContext = createContext<AppDispatch | undefined>(undefined);

interface AppProviderProps {
  initialState?: AppState;
  children: React.ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ initialState = initialAppState, children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const stateValue = useMemo(() => state, [state]);

  return (
    <StateContext.Provider value={stateValue}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
};

export function useAppState(): AppState {
  const context = useContext(StateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppProvider');
  }
  return context;
}

export function useAppDispatch(): AppDispatch {
  const context = useContext(DispatchContext);
  if (!context) {
    throw new Error('useAppDispatch must be used within an AppProvider');
  }
  return context;
}
