import { useState } from 'react';
import type { ReactNode } from 'react';
import { SettingsContext } from './context';
import type { DistanceUnit } from './types';

interface Props {
  children: ReactNode;
}

export function SettingsProvider({ children }: Props) {
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('km');

  const toggleDistanceUnit = () => {
    setDistanceUnit(prev => prev === 'km' ? 'mi' : 'km');
  };

  return (
    <SettingsContext.Provider value={{ distanceUnit, toggleDistanceUnit, setDistanceUnit }}>
      {children}
    </SettingsContext.Provider>
  );
}