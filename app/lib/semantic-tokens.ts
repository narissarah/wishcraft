/**
 * Polaris Semantic Tokens Implementation
 * Following Polaris Design System v13+ semantic token patterns
 */

// Base color palette following Polaris design system
export const baseColors = {
  // Primary colors
  primary: '#008060',
  primaryDark: '#006A56',
  primaryLight: '#1AA27F',
  
  // Surface colors
  surface: '#FFFFFF',
  surfaceSubdued: '#FAFBFB',
  surfaceDisabled: '#F6F6F7',
  
  // Background colors
  background: '#FFFFFF',
  backgroundSubdued: '#F6F6F7',
  
  // Text colors
  text: '#202223',
  textSubdued: '#6D7175',
  textDisabled: '#8C9196',
  
  // Interactive colors
  interactive: '#2C6ECB',
  interactiveHovered: '#1F5199',
  interactivePressed: '#103262',
  
  // Status colors
  critical: '#D72C0D',
  warning: '#FFC453',
  success: '#008060',
  info: '#2C6ECB',
  
  // Border colors
  border: '#E1E3E5',
  borderSubdued: '#C9CCCF',
  
  // Shadow colors
  shadow: 'rgba(23, 24, 24, 0.05)',
  shadowDark: 'rgba(23, 24, 24, 0.15)',
};

// Semantic color tokens
export const semanticColors = {
  // Surface tokens
  'color-bg-surface': baseColors.surface,
  'color-bg-surface-hover': baseColors.surfaceSubdued,
  'color-bg-surface-active': baseColors.surfaceDisabled,
  'color-bg-surface-selected': baseColors.surfaceSubdued,
  'color-bg-surface-disabled': baseColors.surfaceDisabled,
  
  // Primary tokens
  'color-bg-primary': baseColors.primary,
  'color-bg-primary-hover': baseColors.primaryDark,
  'color-bg-primary-active': baseColors.primaryDark,
  'color-bg-primary-disabled': baseColors.surfaceDisabled,
  
  // Critical tokens
  'color-bg-critical': baseColors.critical,
  'color-bg-critical-hover': '#C72C0D',
  'color-bg-critical-active': '#B32C0D',
  'color-bg-critical-disabled': baseColors.surfaceDisabled,
  
  // Warning tokens
  'color-bg-warning': baseColors.warning,
  'color-bg-warning-hover': '#F0B500',
  'color-bg-warning-active': '#E0A500',
  
  // Success tokens
  'color-bg-success': baseColors.success,
  'color-bg-success-hover': baseColors.primaryDark,
  'color-bg-success-active': baseColors.primaryDark,
  
  // Info tokens
  'color-bg-info': baseColors.info,
  'color-bg-info-hover': baseColors.interactiveHovered,
  'color-bg-info-active': baseColors.interactivePressed,
  
  // Text tokens
  'color-text': baseColors.text,
  'color-text-subdued': baseColors.textSubdued,
  'color-text-disabled': baseColors.textDisabled,
  'color-text-on-primary': baseColors.surface,
  'color-text-on-critical': baseColors.surface,
  'color-text-on-warning': baseColors.text,
  'color-text-on-success': baseColors.surface,
  'color-text-on-info': baseColors.surface,
  
  // Interactive text tokens
  'color-text-interactive': baseColors.interactive,
  'color-text-interactive-hover': baseColors.interactiveHovered,
  'color-text-interactive-active': baseColors.interactivePressed,
  'color-text-interactive-disabled': baseColors.textDisabled,
  
  // Border tokens
  'color-border': baseColors.border,
  'color-border-subdued': baseColors.borderSubdued,
  'color-border-interactive': baseColors.interactive,
  'color-border-critical': baseColors.critical,
  'color-border-warning': baseColors.warning,
  'color-border-success': baseColors.success,
  'color-border-info': baseColors.info,
  
  // Icon tokens
  'color-icon': baseColors.text,
  'color-icon-subdued': baseColors.textSubdued,
  'color-icon-disabled': baseColors.textDisabled,
  'color-icon-on-primary': baseColors.surface,
  'color-icon-on-critical': baseColors.surface,
  'color-icon-on-warning': baseColors.text,
  'color-icon-on-success': baseColors.surface,
  'color-icon-on-info': baseColors.surface,
  
  // Interactive icon tokens
  'color-icon-interactive': baseColors.interactive,
  'color-icon-interactive-hover': baseColors.interactiveHovered,
  'color-icon-interactive-active': baseColors.interactivePressed,
  'color-icon-interactive-disabled': baseColors.textDisabled,
};

// Spacing tokens
export const spacing = {
  'space-0': '0px',
  'space-025': '1px',
  'space-050': '2px',
  'space-100': '4px',
  'space-150': '6px',
  'space-200': '8px',
  'space-300': '12px',
  'space-400': '16px',
  'space-500': '20px',
  'space-600': '24px',
  'space-800': '32px',
  'space-1000': '40px',
  'space-1200': '48px',
  'space-1600': '64px',
  'space-2000': '80px',
  'space-2400': '96px',
  'space-2800': '112px',
  'space-3200': '128px',
};

// Typography tokens
export const typography = {
  'font-family-sans': 'Inter, -apple-system, BlinkMacSystemFont, San Francisco, Segoe UI, Roboto, Helvetica Neue, sans-serif',
  'font-family-mono': 'ui-monospace, SFMono-Regular, SF Mono, Consolas, Liberation Mono, Menlo, monospace',
  
  // Font sizes
  'font-size-75': '12px',
  'font-size-100': '14px',
  'font-size-200': '16px',
  'font-size-300': '20px',
  'font-size-400': '24px',
  'font-size-500': '28px',
  'font-size-600': '32px',
  'font-size-700': '40px',
  'font-size-800': '48px',
  'font-size-900': '64px',
  
  // Font weights
  'font-weight-regular': '400',
  'font-weight-medium': '500',
  'font-weight-semibold': '600',
  'font-weight-bold': '700',
  
  // Line heights
  'line-height-1': '16px',
  'line-height-2': '20px',
  'line-height-3': '24px',
  'line-height-4': '28px',
  'line-height-5': '32px',
  'line-height-6': '36px',
  'line-height-7': '44px',
  'line-height-8': '52px',
  'line-height-9': '68px',
};

// Border radius tokens
export const borderRadius = {
  'border-radius-0': '0px',
  'border-radius-050': '2px',
  'border-radius-100': '4px',
  'border-radius-150': '6px',
  'border-radius-200': '8px',
  'border-radius-300': '12px',
  'border-radius-400': '16px',
  'border-radius-500': '20px',
  'border-radius-750': '30px',
  'border-radius-full': '9999px',
};

// Shadow tokens
export const shadows = {
  'shadow-none': 'none',
  'shadow-100': '0 1px 0 rgba(22, 29, 37, 0.05)',
  'shadow-200': '0 3px 2px -1px rgba(22, 29, 37, 0.06), 0 1px 0 rgba(22, 29, 37, 0.05)',
  'shadow-300': '0 4px 6px -2px rgba(22, 29, 37, 0.06), 0 1px 0 rgba(22, 29, 37, 0.05)',
  'shadow-400': '0 8px 16px -4px rgba(22, 29, 37, 0.08), 0 1px 0 rgba(22, 29, 37, 0.05)',
  'shadow-500': '0 12px 20px -8px rgba(22, 29, 37, 0.12), 0 1px 0 rgba(22, 29, 37, 0.05)',
  'shadow-600': '0 20px 32px -8px rgba(22, 29, 37, 0.16), 0 1px 0 rgba(22, 29, 37, 0.05)',
  'shadow-inset': 'inset 0 1px 0 rgba(22, 29, 37, 0.05)',
};

// Z-index tokens
export const zIndex = {
  'z-index-0': '0',
  'z-index-1': '100',
  'z-index-2': '200',
  'z-index-3': '300',
  'z-index-4': '400',
  'z-index-5': '500',
  'z-index-6': '600',
  'z-index-7': '700',
  'z-index-8': '800',
  'z-index-9': '900',
  'z-index-10': '1000',
  'z-index-11': '1100',
  'z-index-12': '1200',
};

// Motion tokens
export const motion = {
  'motion-duration-0': '0ms',
  'motion-duration-50': '50ms',
  'motion-duration-100': '100ms',
  'motion-duration-150': '150ms',
  'motion-duration-200': '200ms',
  'motion-duration-250': '250ms',
  'motion-duration-300': '300ms',
  'motion-duration-350': '350ms',
  'motion-duration-400': '400ms',
  'motion-duration-450': '450ms',
  'motion-duration-500': '500ms',
  
  'motion-ease': 'ease',
  'motion-ease-in': 'ease-in',
  'motion-ease-out': 'ease-out',
  'motion-ease-in-out': 'ease-in-out',
  'motion-linear': 'linear',
  
  'motion-keyframes-bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  'motion-keyframes-fade-in': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  'motion-keyframes-fade-out': 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
  'motion-keyframes-slide-in': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  'motion-keyframes-slide-out': 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
};

// Breakpoint tokens
export const breakpoints = {
  'breakpoint-xs': '0px',
  'breakpoint-sm': '490px',
  'breakpoint-md': '768px',
  'breakpoint-lg': '1024px',
  'breakpoint-xl': '1280px',
};

// Dark mode color overrides
export const darkModeColors = {
  'color-bg-surface': '#1A1A1A',
  'color-bg-surface-hover': '#262626',
  'color-bg-surface-active': '#333333',
  'color-bg-surface-selected': '#262626',
  'color-bg-surface-disabled': '#404040',
  
  'color-text': '#FFFFFF',
  'color-text-subdued': '#B3B3B3',
  'color-text-disabled': '#8C8C8C',
  
  'color-border': '#404040',
  'color-border-subdued': '#595959',
  
  'color-icon': '#FFFFFF',
  'color-icon-subdued': '#B3B3B3',
  'color-icon-disabled': '#8C8C8C',
};

// Combine all tokens
export const tokens = {
  ...semanticColors,
  ...spacing,
  ...typography,
  ...borderRadius,
  ...shadows,
  ...zIndex,
  ...motion,
  ...breakpoints,
};

// Theme configuration
export interface ThemeConfig {
  colors: Record<string, string>;
  spacing: Record<string, string>;
  typography: Record<string, string>;
  borderRadius: Record<string, string>;
  shadows: Record<string, string>;
  zIndex: Record<string, string>;
  motion: Record<string, string>;
  breakpoints: Record<string, string>;
  darkMode?: boolean;
}

/**
 * Get theme configuration
 */
export function getTheme(darkMode: boolean = false): ThemeConfig {
  return {
    colors: darkMode ? { ...semanticColors, ...darkModeColors } : semanticColors,
    spacing,
    typography,
    borderRadius,
    shadows,
    zIndex,
    motion,
    breakpoints,
    darkMode,
  };
}

/**
 * Generate CSS custom properties from tokens
 */
export function generateCSSCustomProperties(theme: ThemeConfig): string {
  const cssProps: string[] = [];
  
  Object.entries(theme.colors).forEach(([key, value]) => {
    cssProps.push(`--p-${key}: ${value};`);
  });
  
  Object.entries(theme.spacing).forEach(([key, value]) => {
    cssProps.push(`--p-${key}: ${value};`);
  });
  
  Object.entries(theme.typography).forEach(([key, value]) => {
    cssProps.push(`--p-${key}: ${value};`);
  });
  
  Object.entries(theme.borderRadius).forEach(([key, value]) => {
    cssProps.push(`--p-${key}: ${value};`);
  });
  
  Object.entries(theme.shadows).forEach(([key, value]) => {
    cssProps.push(`--p-${key}: ${value};`);
  });
  
  Object.entries(theme.zIndex).forEach(([key, value]) => {
    cssProps.push(`--p-${key}: ${value};`);
  });
  
  Object.entries(theme.motion).forEach(([key, value]) => {
    cssProps.push(`--p-${key}: ${value};`);
  });
  
  Object.entries(theme.breakpoints).forEach(([key, value]) => {
    cssProps.push(`--p-${key}: ${value};`);
  });
  
  return `:root {
    ${cssProps.join('\n    ')}
  }`;
}

/**
 * Get token value with fallback
 */
export function getToken(tokenName: string, fallback?: string): string {
  return tokens[tokenName] || fallback || '';
}

/**
 * Media query utilities using semantic tokens
 */
export const mediaQueries = {
  xs: `@media (min-width: ${breakpoints['breakpoint-xs']})`,
  sm: `@media (min-width: ${breakpoints['breakpoint-sm']})`,
  md: `@media (min-width: ${breakpoints['breakpoint-md']})`,
  lg: `@media (min-width: ${breakpoints['breakpoint-lg']})`,
  xl: `@media (min-width: ${breakpoints['breakpoint-xl']})`,
  
  darkMode: '@media (prefers-color-scheme: dark)',
  reducedMotion: '@media (prefers-reduced-motion: reduce)',
  highContrast: '@media (prefers-contrast: high)',
};

/**
 * Utility function to create responsive styles
 */
export function responsive(styles: Record<string, any>): Record<string, any> {
  const responsiveStyles: Record<string, any> = {};
  
  Object.entries(styles).forEach(([breakpoint, style]) => {
    if (breakpoint === 'base') {
      Object.assign(responsiveStyles, style);
    } else if (mediaQueries[breakpoint]) {
      responsiveStyles[mediaQueries[breakpoint]] = style;
    }
  });
  
  return responsiveStyles;
}

/**
 * Component-specific token utilities
 */
export const componentTokens = {
  button: {
    primary: {
      backgroundColor: 'var(--p-color-bg-primary)',
      color: 'var(--p-color-text-on-primary)',
      borderColor: 'var(--p-color-border-primary)',
      ':hover': {
        backgroundColor: 'var(--p-color-bg-primary-hover)',
      },
      ':active': {
        backgroundColor: 'var(--p-color-bg-primary-active)',
      },
      ':disabled': {
        backgroundColor: 'var(--p-color-bg-primary-disabled)',
        color: 'var(--p-color-text-disabled)',
      },
    },
    secondary: {
      backgroundColor: 'var(--p-color-bg-surface)',
      color: 'var(--p-color-text)',
      borderColor: 'var(--p-color-border)',
      ':hover': {
        backgroundColor: 'var(--p-color-bg-surface-hover)',
      },
      ':active': {
        backgroundColor: 'var(--p-color-bg-surface-active)',
      },
    },
    critical: {
      backgroundColor: 'var(--p-color-bg-critical)',
      color: 'var(--p-color-text-on-critical)',
      borderColor: 'var(--p-color-border-critical)',
      ':hover': {
        backgroundColor: 'var(--p-color-bg-critical-hover)',
      },
      ':active': {
        backgroundColor: 'var(--p-color-bg-critical-active)',
      },
    },
  },
  card: {
    backgroundColor: 'var(--p-color-bg-surface)',
    borderColor: 'var(--p-color-border)',
    borderRadius: 'var(--p-border-radius-200)',
    boxShadow: 'var(--p-shadow-200)',
    padding: 'var(--p-space-400)',
  },
  text: {
    heading: {
      color: 'var(--p-color-text)',
      fontFamily: 'var(--p-font-family-sans)',
      fontWeight: 'var(--p-font-weight-semibold)',
    },
    body: {
      color: 'var(--p-color-text)',
      fontFamily: 'var(--p-font-family-sans)',
      fontWeight: 'var(--p-font-weight-regular)',
    },
    subdued: {
      color: 'var(--p-color-text-subdued)',
      fontFamily: 'var(--p-font-family-sans)',
      fontWeight: 'var(--p-font-weight-regular)',
    },
  },
};

/**
 * Theme provider context values
 */
export const themeContextValues = {
  tokens,
  getTheme,
  getToken,
  mediaQueries,
  responsive,
  componentTokens,
  generateCSSCustomProperties,
};

// Export default theme
export const defaultTheme = getTheme(false);
export const darkTheme = getTheme(true);

/**
 * User preference detection utilities
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function prefersDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function prefersHighContrast(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-contrast: high)').matches;
}