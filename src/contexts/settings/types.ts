export type DistanceUnit = 'km' | 'mi';
export type ThemeMode = 'light' | 'dark' | 'auto';
export type ColorScheme = 'orange' | 'pink' | 'purple' | 'blue' | 'green' | 'red';

export interface Settings {
  distanceUnit: DistanceUnit;
  toggleDistanceUnit: () => void;
  setDistanceUnit: (unit: DistanceUnit) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  showDistanceLabels: boolean;
  setShowDistanceLabels: (show: boolean) => void;
  autoRefresh: boolean;
  setAutoRefresh: (enabled: boolean) => void;
}