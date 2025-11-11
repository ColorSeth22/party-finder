import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { SettingsContext } from './context';
import type { DistanceUnit, ThemeMode, ColorScheme } from './types';

const STORAGE_KEY_DISTANCE = 'partyfinder_distance_unit';
const STORAGE_KEY_THEME = 'partyfinder_theme_mode';
const STORAGE_KEY_COLOR_SCHEME = 'partyfinder_color_scheme';
const STORAGE_KEY_SHOW_DISTANCE = 'partyfinder_show_distance';
const STORAGE_KEY_AUTO_REFRESH = 'partyfinder_auto_refresh';

interface Props {
  children: ReactNode;
}

export function SettingsProvider({ children }: Props) {
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_DISTANCE);
    return (stored === 'km' || stored === 'mi') ? stored : 'km';
  });

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_THEME);
    return (stored === 'light' || stored === 'dark' || stored === 'auto') ? stored : 'auto';
  });

  const [colorScheme, setColorScheme] = useState<ColorScheme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_COLOR_SCHEME);
    return (stored === 'orange' || stored === 'pink' || stored === 'purple' || stored === 'blue' || stored === 'green' || stored === 'red') 
      ? stored 
      : 'orange';
  });

  const [showDistanceLabels, setShowDistanceLabels] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_SHOW_DISTANCE);
    return stored === null ? true : stored === 'true';
  });

  const [autoRefresh, setAutoRefresh] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_AUTO_REFRESH);
    return stored === null ? true : stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DISTANCE, distanceUnit);
  }, [distanceUnit]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_THEME, themeMode);
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_COLOR_SCHEME, colorScheme);
  }, [colorScheme]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SHOW_DISTANCE, showDistanceLabels.toString());
  }, [showDistanceLabels]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_AUTO_REFRESH, autoRefresh.toString());
  }, [autoRefresh]);

  const toggleDistanceUnit = () => {
    setDistanceUnit(prev => prev === 'km' ? 'mi' : 'km');
  };

  return (
    <SettingsContext.Provider value={{ 
      distanceUnit, 
      toggleDistanceUnit, 
      setDistanceUnit,
      themeMode,
      setThemeMode,
      colorScheme,
      setColorScheme,
      showDistanceLabels,
      setShowDistanceLabels,
      autoRefresh,
      setAutoRefresh
    }}>
      {children}
    </SettingsContext.Provider>
  );
}