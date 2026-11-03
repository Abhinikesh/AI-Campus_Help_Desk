/**
 * client/src/context/ThemeContext.jsx
 * Light Theme Enforcement Provider for CampusSphere AI.
 * Enforces pure light mode across all portals, dashboards, and components.
 */
import React, { createContext, useContext, useEffect, useMemo, useCallback } from 'react';

const THEME_STORAGE_KEY = 'campussphere_theme';

const ThemeContext = createContext({
  theme: 'light',
  isDark: false,
  setTheme: () => {},
  toggleTheme: () => {},
});

export const ThemeProvider = ({ children }) => {
  // Always enforce light mode on DOM root
  const enforceLightMode = useCallback(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
    root.classList.add('light');
    root.setAttribute('data-theme', 'light');
    root.style.colorScheme = 'light';
    try {
      localStorage.removeItem(THEME_STORAGE_KEY);
      localStorage.setItem(THEME_STORAGE_KEY, 'light');
    } catch {
      // Ignore storage errors in restricted environments
    }
  }, []);

  useEffect(() => {
    enforceLightMode();
  }, [enforceLightMode]);

  // Backward compatible no-op setters (ensures no component crashes if called)
  const setTheme = useCallback(() => {
    enforceLightMode();
  }, [enforceLightMode]);

  const toggleTheme = useCallback(() => {
    enforceLightMode();
  }, [enforceLightMode]);

  const contextValue = useMemo(
    () => ({
      theme: 'light',
      isDark: false,
      setTheme,
      toggleTheme,
    }),
    [setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
