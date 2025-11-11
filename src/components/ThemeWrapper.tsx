import { useMemo, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useSettings } from '../contexts/settings/hooks';
import type { ReactNode } from 'react';
import type { ColorScheme } from '../contexts/settings/types';

interface Props {
  children: ReactNode;
}

const colorSchemes: Record<ColorScheme, { light: string; dark: string; secondary: string }> = {
  orange: {
    light: '#ff6b35',
    dark: '#ff9d6c',
    secondary: '#f7931e',
  },
  pink: {
    light: '#e91e63',
    dark: '#f48fb1',
    secondary: '#ff4081',
  },
  purple: {
    light: '#9c27b0',
    dark: '#ce93d8',
    secondary: '#ab47bc',
  },
  blue: {
    light: '#2196f3',
    dark: '#64b5f6',
    secondary: '#42a5f5',
  },
  green: {
    light: '#4caf50',
    dark: '#81c784',
    secondary: '#66bb6a',
  },
  red: {
    light: '#f44336',
    dark: '#e57373',
    secondary: '#ef5350',
  },
};

export function ThemeWrapper({ children }: Props) {
  const { themeMode, colorScheme } = useSettings();
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  const theme = useMemo(() => {
    let mode: 'light' | 'dark' = 'light';
    
    if (themeMode === 'dark') {
      mode = 'dark';
    } else if (themeMode === 'auto') {
      mode = prefersDarkMode ? 'dark' : 'light';
    }

    const colors = colorSchemes[colorScheme];

    return createTheme({
      palette: {
        mode,
        primary: {
          main: mode === 'dark' ? colors.dark : colors.light,
        },
        secondary: {
          main: colors.secondary,
        },
        background: {
          default: mode === 'dark' ? '#121212' : '#fafafa',
          paper: mode === 'dark' ? '#1e1e1e' : '#ffffff',
        },
      },
      typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      },
    });
  }, [themeMode, colorScheme, prefersDarkMode]);

  // Set CSS variables for Leaflet popup styling
  useEffect(() => {
    const isDark = theme.palette.mode === 'dark';
    const root = document.documentElement;
    
    if (isDark) {
      root.style.setProperty('--popup-bg', '#1e1e1e');
      root.style.setProperty('--popup-text', '#ffffff');
      root.style.setProperty('--popup-link', '#90caf9');
    } else {
      root.style.setProperty('--popup-bg', '#ffffff');
      root.style.setProperty('--popup-text', '#000000');
      root.style.setProperty('--popup-link', '#1976d2');
    }
  }, [theme.palette.mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
