import { createContext } from 'react';
import type { Settings } from './types';

export const SettingsContext = createContext<Settings | null>(null);