/**
 * Theme Provider Component
 * Manages semantic tokens and theme switching
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { 
  defaultTheme, 
  darkTheme, 
  generateCSSCustomProperties, 
  type ThemeConfig,
  prefersReducedMotion,
  prefersDarkMode,
  prefersHighContrast
} from '~/lib/semantic-tokens';

interface ThemeContextType {
  theme: ThemeConfig;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: ThemeConfig) => void;
  preferences: {
    reducedMotion: boolean;
    highContrast: boolean;
    darkMode: boolean;
  };
  updatePreferences: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  initialTheme?: ThemeConfig;
  storageKey?: string;
}

export function ThemeProvider({ 
  children, 
  initialTheme,
  storageKey = 'wishcraft-theme' 
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeConfig>(initialTheme || defaultTheme);
  const [isDark, setIsDark] = useState(false);
  const [preferences, setPreferences] = useState({
    reducedMotion: false,
    highContrast: false,
    darkMode: false,
  });

  // Update user preferences
  const updatePreferences = useCallback(() => {
    setPreferences({
      reducedMotion: prefersReducedMotion(),
      highContrast: prefersHighContrast(),
      darkMode: prefersDarkMode(),
    });
  }, []);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      updatePreferences();
      
      const savedTheme = localStorage.getItem(storageKey);
      if (savedTheme) {
        try {
          const parsedTheme = JSON.parse(savedTheme);
          setThemeState(parsedTheme);
          setIsDark(parsedTheme.darkMode || false);
        } catch (error) {
          console.warn('Failed to parse saved theme:', error);
        }
      } else {
        // Use system preference
        const systemPrefersDark = prefersDarkMode();
        setIsDark(systemPrefersDark);
        setThemeState(systemPrefersDark ? darkTheme : defaultTheme);
      }
    }
  }, [storageKey, updatePreferences]);

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        updatePreferences();
        if (!localStorage.getItem(storageKey)) {
          // Only auto-switch if user hasn't manually set a theme
          setIsDark(e.matches);
          setThemeState(e.matches ? darkTheme : defaultTheme);
        }
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [storageKey, updatePreferences]);

  // Listen for reduced motion preference changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      const handleChange = () => updatePreferences();

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [updatePreferences]);

  // Listen for high contrast preference changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-contrast: high)');
      const handleChange = () => updatePreferences();

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [updatePreferences]);

  // Apply theme to document
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const cssCustomProperties = generateCSSCustomProperties(theme);
      
      // Remove existing theme style
      const existingStyle = document.getElementById('wishcraft-theme-styles');
      if (existingStyle) {
        existingStyle.remove();
      }

      // Add new theme style
      const style = document.createElement('style');
      style.id = 'wishcraft-theme-styles';
      style.textContent = cssCustomProperties;
      document.head.appendChild(style);

      // Add theme class to body
      document.body.className = document.body.className.replace(/theme-\w+/g, '');
      document.body.classList.add(isDark ? 'theme-dark' : 'theme-light');
      
      // Add preference classes
      document.body.classList.toggle('prefers-reduced-motion', preferences.reducedMotion);
      document.body.classList.toggle('prefers-high-contrast', preferences.highContrast);
    }
  }, [theme, isDark, preferences]);

  // Toggle between light and dark theme
  const toggleTheme = useCallback(() => {
    const newIsDark = !isDark;
    const newTheme = newIsDark ? darkTheme : defaultTheme;
    
    setIsDark(newIsDark);
    setThemeState(newTheme);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(newTheme));
    }
  }, [isDark, storageKey]);

  // Set custom theme
  const setTheme = useCallback((newTheme: ThemeConfig) => {
    setThemeState(newTheme);
    setIsDark(newTheme.darkMode || false);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(newTheme));
    }
  }, [storageKey]);

  const contextValue: ThemeContextType = {
    theme,
    isDark,
    toggleTheme,
    setTheme,
    preferences,
    updatePreferences,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to use theme context
 */
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Theme toggle button component
 */
export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      style={{
        background: 'var(--p-color-bg-surface)',
        border: '1px solid var(--p-color-border)',
        borderRadius: 'var(--p-border-radius-200)',
        padding: 'var(--p-space-200)',
        color: 'var(--p-color-text)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--p-space-200)',
        fontSize: 'var(--p-font-size-100)',
        fontFamily: 'var(--p-font-family-sans)',
        transition: 'all var(--p-motion-duration-150) var(--p-motion-ease)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--p-color-bg-surface-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--p-color-bg-surface)';
      }}
    >
      <span role="img" aria-label={isDark ? 'Dark mode' : 'Light mode'}>
        {isDark ? '🌙' : '☀️'}
      </span>
      {isDark ? 'Dark' : 'Light'}
    </button>
  );
}

/**
 * Hook to get semantic token values
 */
export function useTokens() {
  const { theme } = useTheme();
  
  const getToken = useCallback((tokenName: string, fallback?: string): string => {
    const tokenValue = theme.colors[tokenName] || 
                     theme.spacing[tokenName] || 
                     theme.typography[tokenName] || 
                     theme.borderRadius[tokenName] || 
                     theme.shadows[tokenName] || 
                     theme.zIndex[tokenName] || 
                     theme.motion[tokenName] || 
                     theme.breakpoints[tokenName];
    
    return tokenValue || fallback || '';
  }, [theme]);

  return { getToken, theme };
}

/**
 * Hook for responsive design
 */
export function useResponsive() {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleResize = () => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const isXs = windowSize.width >= 0;
  const isSm = windowSize.width >= 490;
  const isMd = windowSize.width >= 768;
  const isLg = windowSize.width >= 1024;
  const isXl = windowSize.width >= 1280;

  return {
    windowSize,
    isXs,
    isSm,
    isMd,
    isLg,
    isXl,
    isMobile: !isSm,
    isTablet: isSm && !isLg,
    isDesktop: isLg,
  };
}

/**
 * Custom hook for accessible color contrast
 */
export function useAccessibleColors() {
  const { theme, preferences } = useTheme();
  
  const getContrastColor = useCallback((backgroundColor: string): string => {
    if (preferences.highContrast) {
      // Use high contrast colors
      return backgroundColor === theme.colors['color-bg-surface'] 
        ? theme.colors['color-text'] 
        : theme.colors['color-text-on-primary'];
    }
    
    // Use regular contrast colors
    return theme.colors['color-text'];
  }, [theme, preferences]);

  const getAccessiblePair = useCallback((intent: 'primary' | 'critical' | 'success' | 'warning' | 'info' = 'primary') => {
    const backgroundKey = `color-bg-${intent}`;
    const textKey = `color-text-on-${intent}`;
    
    return {
      backgroundColor: theme.colors[backgroundKey],
      color: theme.colors[textKey],
    };
  }, [theme]);

  return {
    getContrastColor,
    getAccessiblePair,
  };
}

/**
 * Animation hook that respects user preferences
 */
export function useAccessibleAnimation() {
  const { preferences } = useTheme();
  
  const getAnimationStyles = useCallback((animation: any) => {
    if (preferences.reducedMotion) {
      return {
        ...animation,
        transition: 'none',
        animation: 'none',
      };
    }
    
    return animation;
  }, [preferences]);

  return {
    getAnimationStyles,
    reducedMotion: preferences.reducedMotion,
  };
}

/**
 * Export theme utilities
 */
export { generateCSSCustomProperties } from '~/lib/semantic-tokens';