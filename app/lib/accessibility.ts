/**
 * Accessibility utilities for WishCraft
 * Comprehensive ARIA attributes and screen reader support
 */

import type { CSSProperties } from 'react';

export interface AccessibilityConfig {
  label?: string;
  description?: string;
  required?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  selected?: boolean;
  checked?: boolean;
  pressed?: boolean;
  hidden?: boolean;
  live?: 'polite' | 'assertive' | 'off';
  atomic?: boolean;
  busy?: boolean;
  controls?: string;
  describedBy?: string;
  labelledBy?: string;
  owns?: string;
  flowTo?: string;
  hasPopup?: boolean | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
  role?: string;
  level?: number;
  posinset?: number;
  setsize?: number;
  valuemin?: number;
  valuemax?: number;
  valuenow?: number;
  valuetext?: string;
  orientation?: 'horizontal' | 'vertical';
  sort?: 'ascending' | 'descending' | 'none' | 'other';
  autocomplete?: string;
  multiline?: boolean;
  multiselectable?: boolean;
  readonly?: boolean;
  current?: boolean | 'page' | 'step' | 'location' | 'date' | 'time';
  dropeffect?: 'copy' | 'execute' | 'link' | 'move' | 'none' | 'popup';
  grabbed?: boolean;
  keyshortcuts?: string;
  roledescription?: string;
}

/**
 * Generate ARIA attributes object from configuration
 */
export function generateAriaAttributes(config: AccessibilityConfig): Record<string, any> {
  const attributes: Record<string, any> = {};

  if (config.label) attributes['aria-label'] = config.label;
  if (config.description) attributes['aria-description'] = config.description;
  if (config.required !== undefined) attributes['aria-required'] = config.required;
  if (config.invalid !== undefined) attributes['aria-invalid'] = config.invalid;
  if (config.disabled !== undefined) attributes['aria-disabled'] = config.disabled;
  if (config.expanded !== undefined) attributes['aria-expanded'] = config.expanded;
  if (config.selected !== undefined) attributes['aria-selected'] = config.selected;
  if (config.checked !== undefined) attributes['aria-checked'] = config.checked;
  if (config.pressed !== undefined) attributes['aria-pressed'] = config.pressed;
  if (config.hidden !== undefined) attributes['aria-hidden'] = config.hidden;
  if (config.live) attributes['aria-live'] = config.live;
  if (config.atomic !== undefined) attributes['aria-atomic'] = config.atomic;
  if (config.busy !== undefined) attributes['aria-busy'] = config.busy;
  if (config.controls) attributes['aria-controls'] = config.controls;
  if (config.describedBy) attributes['aria-describedby'] = config.describedBy;
  if (config.labelledBy) attributes['aria-labelledby'] = config.labelledBy;
  if (config.owns) attributes['aria-owns'] = config.owns;
  if (config.flowTo) attributes['aria-flowto'] = config.flowTo;
  if (config.hasPopup !== undefined) attributes['aria-haspopup'] = config.hasPopup;
  if (config.role) attributes['role'] = config.role;
  if (config.level) attributes['aria-level'] = config.level;
  if (config.posinset) attributes['aria-posinset'] = config.posinset;
  if (config.setsize) attributes['aria-setsize'] = config.setsize;
  if (config.valuemin !== undefined) attributes['aria-valuemin'] = config.valuemin;
  if (config.valuemax !== undefined) attributes['aria-valuemax'] = config.valuemax;
  if (config.valuenow !== undefined) attributes['aria-valuenow'] = config.valuenow;
  if (config.valuetext) attributes['aria-valuetext'] = config.valuetext;
  if (config.orientation) attributes['aria-orientation'] = config.orientation;
  if (config.sort) attributes['aria-sort'] = config.sort;
  if (config.autocomplete) attributes['aria-autocomplete'] = config.autocomplete;
  if (config.multiline !== undefined) attributes['aria-multiline'] = config.multiline;
  if (config.multiselectable !== undefined) attributes['aria-multiselectable'] = config.multiselectable;
  if (config.readonly !== undefined) attributes['aria-readonly'] = config.readonly;
  if (config.current !== undefined) attributes['aria-current'] = config.current;
  if (config.dropeffect) attributes['aria-dropeffect'] = config.dropeffect;
  if (config.grabbed !== undefined) attributes['aria-grabbed'] = config.grabbed;
  if (config.keyshortcuts) attributes['aria-keyshortcuts'] = config.keyshortcuts;
  if (config.roledescription) attributes['aria-roledescription'] = config.roledescription;

  return attributes;
}

/**
 * Screen reader only styles for visually hidden content
 */
export const srOnlyStyles = {
  position: 'absolute' as const,
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap' as const,
  border: 0,
};

/**
 * Generate unique IDs for ARIA relationships
 */
export function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create announcement for screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.style.position = 'absolute';
  announcement.style.left = '-10000px';
  announcement.style.width = '1px';
  announcement.style.height = '1px';
  announcement.style.overflow = 'hidden';
  
  document.body.appendChild(announcement);
  announcement.textContent = message;
  
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Focus management utilities
 */
export const focusManagement = {
  /**
   * Set focus to element with ID
   */
  focusElement(elementId: string): void {
    const element = document.getElementById(elementId);
    if (element) {
      element.focus();
    }
  },

  /**
   * Get all focusable elements within a container
   */
  getFocusableElements(container: HTMLElement): HTMLElement[] {
    const focusableSelectors = [
      'button:not([disabled])',
      '[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ];

    return Array.from(container.querySelectorAll(focusableSelectors.join(', '))) as HTMLElement[];
  },

  /**
   * Trap focus within a container
   */
  trapFocus(container: HTMLElement): () => void {
    const focusableElements = this.getFocusableElements(container);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Tab') {
        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown);
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }
};

/**
 * Keyboard navigation utilities
 */
export const keyboardNavigation = {
  /**
   * Handle arrow key navigation for lists
   */
  handleArrowKeys(event: KeyboardEvent, items: HTMLElement[], currentIndex: number): number {
    let newIndex = currentIndex;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        newIndex = Math.min(currentIndex + 1, items.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        newIndex = Math.max(currentIndex - 1, 0);
        break;
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        newIndex = items.length - 1;
        break;
    }

    if (newIndex !== currentIndex) {
      items[newIndex].focus();
    }

    return newIndex;
  },

  /**
   * Handle escape key to close modals/menus
   */
  handleEscape(event: KeyboardEvent, onEscape: () => void): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      onEscape();
    }
  }
};

/**
 * Form accessibility utilities
 */
export const formAccessibility = {
  /**
   * Generate form field accessibility attributes
   */
  getFieldAttributes(config: {
    id: string;
    label?: string;
    description?: string;
    error?: string;
    required?: boolean;
    invalid?: boolean;
  }): Record<string, any> {
    const attributes: Record<string, any> = {};

    if (config.label) {
      attributes['aria-label'] = config.label;
    }

    if (config.description) {
      const descriptionId = `${config.id}-description`;
      attributes['aria-describedby'] = descriptionId;
    }

    if (config.error) {
      const errorId = `${config.id}-error`;
      attributes['aria-describedby'] = config.description 
        ? `${config.id}-description ${errorId}`
        : errorId;
      attributes['aria-invalid'] = true;
    }

    if (config.required) {
      attributes['aria-required'] = true;
    }

    if (config.invalid) {
      attributes['aria-invalid'] = true;
    }

    return attributes;
  },

  /**
   * Generate validation message attributes
   */
  getValidationAttributes(fieldId: string, isError: boolean = false): Record<string, any> {
    return {
      id: `${fieldId}-${isError ? 'error' : 'description'}`,
      'aria-live': 'polite',
      'aria-atomic': 'true',
      role: isError ? 'alert' : 'status'
    };
  }
};

/**
 * Loading state accessibility
 */
export const loadingAccessibility = {
  /**
   * Generate loading state attributes
   */
  getLoadingAttributes(isLoading: boolean, label?: string): Record<string, any> {
    return {
      'aria-busy': isLoading,
      'aria-live': 'polite',
      'aria-label': label || (isLoading ? 'Loading...' : 'Content loaded'),
      role: 'status'
    };
  }
};

/**
 * Table accessibility utilities
 */
export const tableAccessibility = {
  /**
   * Generate table accessibility attributes
   */
  getTableAttributes(caption?: string): Record<string, any> {
    const attributes: Record<string, any> = {
      role: 'table'
    };

    if (caption) {
      attributes['aria-label'] = caption;
    }

    return attributes;
  },

  /**
   * Generate sortable column header attributes
   */
  getSortableHeaderAttributes(column: string, sortDirection?: 'asc' | 'desc'): Record<string, any> {
    return {
      role: 'columnheader',
      'aria-sort': sortDirection ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none',
      'aria-label': `Sort by ${column}`,
      tabIndex: 0
    };
  }
};

/**
 * Modal/Dialog accessibility utilities
 */
export const modalAccessibility = {
  /**
   * Generate modal accessibility attributes
   */
  getModalAttributes(titleId: string, descriptionId?: string): Record<string, any> {
    const attributes: Record<string, any> = {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleId
    };

    if (descriptionId) {
      attributes['aria-describedby'] = descriptionId;
    }

    return attributes;
  }
};

/**
 * Color contrast validation
 */
export const colorContrast = {
  /**
   * Calculate relative luminance
   */
  getLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  },

  /**
   * Calculate contrast ratio between two colors
   */
  getContrastRatio(color1: [number, number, number], color2: [number, number, number]): number {
    const lum1 = this.getLuminance(...color1);
    const lum2 = this.getLuminance(...color2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  },

  /**
   * Check if color combination meets WCAG AA standards
   */
  meetsWCAGAA(foreground: [number, number, number], background: [number, number, number], isLargeText: boolean = false): boolean {
    const ratio = this.getContrastRatio(foreground, background);
    return isLargeText ? ratio >= 3 : ratio >= 4.5;
  },

  /**
   * Check if color combination meets WCAG AAA standards
   */
  meetsWCAGAAA(foreground: [number, number, number], background: [number, number, number], isLargeText: boolean = false): boolean {
    const ratio = this.getContrastRatio(foreground, background);
    return isLargeText ? ratio >= 4.5 : ratio >= 7;
  }
};

/**
 * Utility to check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Utility to check if user prefers high contrast
 */
export function prefersHighContrast(): boolean {
  return window.matchMedia('(prefers-contrast: high)').matches;
}

/**
 * Utility to check if user prefers dark mode
 */
export function prefersDarkMode(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Generate skip link styles for keyboard navigation
 */
export function generateSkipLinkStyles(): CSSProperties {
  return {
    position: 'absolute' as const,
    top: '-40px',
    left: '6px',
    background: 'var(--p-color-bg-primary)',
    color: 'var(--p-color-text-primary)',
    padding: '8px',
    textDecoration: 'none',
    borderRadius: '4px',
    zIndex: 10000,
    fontSize: '14px',
    fontWeight: 'bold',
    border: '2px solid var(--p-color-border-primary)',
    outline: 'none',
    transition: 'top 0.1s ease-in-out',
  };
}

/**
 * Get skip link attributes
 */
export function getSkipLinkAttributes(targetId: string, label: string) {
  return {
    href: `#${targetId}`,
    'aria-label': label,
    className: 'skip-link',
    style: generateSkipLinkStyles(),
  };
}