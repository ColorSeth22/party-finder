import { useContext } from 'react';
import { SettingsContext } from './context';
import type { Settings } from './types';

export function useSettings(): Settings {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}