# WishCraft Component Library Documentation

## Overview

The WishCraft component library provides a comprehensive set of reusable UI components following Shopify's Polaris design system with enhanced accessibility features, semantic tokens, and performance optimizations.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Theme System](#theme-system)
3. [Accessibility Features](#accessibility-features)
4. [Core Components](#core-components)
5. [Specialized Components](#specialized-components)
6. [Hooks and Utilities](#hooks-and-utilities)
7. [Performance Components](#performance-components)
8. [Testing Components](#testing-components)
9. [Best Practices](#best-practices)
10. [Examples](#examples)

## Getting Started

### Installation

The component library is built into the WishCraft application. All components are available through the main imports:

```typescript
import { ComponentName } from '~/components/ComponentName';
import { useHook } from '~/hooks/useHook';
import { utility } from '~/lib/utility';
```

### Basic Usage

```typescript
import { ThemeProvider } from '~/components/ThemeProvider';
import { ContrastValidator } from '~/components/ContrastValidator';

function App() {
  return (
    <ThemeProvider>
      <YourAppContent />
    </ThemeProvider>
  );
}
```

## Theme System

### ThemeProvider

The `ThemeProvider` component manages semantic tokens and theme switching throughout the application.

```typescript
interface ThemeProviderProps {
  children: React.ReactNode;
  initialTheme?: ThemeConfig;
  storageKey?: string;
}

function ThemeProvider({ children, initialTheme, storageKey }: ThemeProviderProps)
```

**Features:**
- Automatic light/dark mode detection
- System preference monitoring
- Persistent theme storage
- Semantic token management
- CSS custom properties generation

**Example:**

```typescript
import { ThemeProvider } from '~/components/ThemeProvider';

function App() {
  return (
    <ThemeProvider storageKey="wishcraft-theme">
      <AppContent />
    </ThemeProvider>
  );
}
```

### ThemeToggle

A simple toggle button for switching between light and dark themes.

```typescript
function ThemeToggle()
```

**Features:**
- Automatic theme detection
- Accessible button with proper ARIA labels
- Visual theme indicators
- Keyboard navigation support

**Example:**

```typescript
import { ThemeToggle } from '~/components/ThemeProvider';

function Header() {
  return (
    <header>
      <h1>WishCraft</h1>
      <ThemeToggle />
    </header>
  );
}
```

### Theme Hooks

#### useTheme

Access the current theme and theme controls.

```typescript
const { theme, isDark, toggleTheme, setTheme, preferences } = useTheme();
```

#### useTokens

Access semantic token values.

```typescript
const { getToken, theme } = useTokens();
const primaryColor = getToken('color-bg-primary');
```

#### useResponsive

Get responsive design information.

```typescript
const { windowSize, isMobile, isTablet, isDesktop } = useResponsive();
```

## Accessibility Features

### ContrastValidator

Validates color contrast ratios for accessibility compliance.

```typescript
interface ContrastValidatorProps {
  foregroundColor: string;
  backgroundColor: string;
  textSize?: 'normal' | 'large';
  showDetails?: boolean;
  onValidationChange?: (isValid: boolean, ratio: number) => void;
}

function ContrastValidator(props: ContrastValidatorProps)
```

**Features:**
- WCAG AA/AAA compliance checking
- Real-time contrast ratio calculation
- Detailed validation reports
- Suggestions for improvement
- Bulk validation support

**Example:**

```typescript
import { ContrastValidator } from '~/components/ContrastValidator';

function ColorSettings() {
  const [foreground, setForeground] = useState('#000000');
  const [background, setBackground] = useState('#ffffff');

  return (
    <div>
      <ColorPicker value={foreground} onChange={setForeground} />
      <ColorPicker value={background} onChange={setBackground} />
      <ContrastValidator
        foregroundColor={foreground}
        backgroundColor={background}
        showDetails={true}
        onValidationChange={(isValid, ratio) => {
          console.log('Contrast valid:', isValid, 'Ratio:', ratio);
        }}
      />
    </div>
  );
}
```

### BulkContrastValidator

Validates multiple color combinations at once.

```typescript
interface BulkContrastValidatorProps {
  colorCombinations: Array<{
    id: string;
    name: string;
    foreground: string;
    background: string;
    textSize?: 'normal' | 'large';
  }>;
  onValidationResults?: (results: Array<{ id: string; isValid: boolean; ratio: number }>) => void;
}

function BulkContrastValidator(props: BulkContrastValidatorProps)
```

**Example:**

```typescript
import { BulkContrastValidator } from '~/components/ContrastValidator';

function AccessibilityAudit() {
  const combinations = [
    { id: 'primary', name: 'Primary Button', foreground: '#ffffff', background: '#008060' },
    { id: 'secondary', name: 'Secondary Button', foreground: '#202223', background: '#f6f6f7' },
    { id: 'text', name: 'Body Text', foreground: '#202223', background: '#ffffff' },
  ];

  return (
    <BulkContrastValidator
      colorCombinations={combinations}
      onValidationResults={(results) => {
        console.log('Validation results:', results);
      }}
    />
  );
}
```

### Accessibility Utilities

```typescript
import { 
  generateAriaAttributes, 
  srOnlyStyles, 
  generateId, 
  announceToScreenReader,
  focusManagement,
  keyboardNavigation
} from '~/lib/accessibility';
```

**Key Functions:**

- `generateAriaAttributes(config)` - Generate ARIA attributes from configuration
- `srOnlyStyles` - Screen reader only styles
- `generateId(prefix)` - Generate unique IDs for ARIA relationships
- `announceToScreenReader(message, priority)` - Create live region announcements
- `focusManagement.trapFocus(container)` - Trap focus within a container
- `keyboardNavigation.handleArrowKeys(event, items, currentIndex)` - Handle arrow key navigation

## Core Components

### Enhanced Admin Dashboard

The admin dashboard has been enhanced with comprehensive accessibility features:

```typescript
// app/routes/admin._index.tsx
export default function AdminDashboard() {
  const { shop, stats, recentRegistries } = useLoaderData<LoaderData>();

  return (
    <Page
      title="WishCraft Dashboard"
      subtitle={`Welcome back to your gift registry management for ${shop.name}`}
      primaryAction={{
        content: "Create Registry",
        icon: PlusIcon,
        url: "/admin/registries/new",
        accessibilityLabel: "Create a new gift registry for customers"
      }}
    >
      <BlockStack gap="500">
        <section aria-labelledby="stats-heading">
          <h2 id="stats-heading" style={srOnlyStyles}>Key Statistics</h2>
          {/* Statistics content */}
        </section>
        
        <section aria-labelledby="quick-actions-heading">
          <h2 id="quick-actions-heading">Quick Actions</h2>
          <nav aria-labelledby="quick-actions-heading">
            {/* Navigation content */}
          </nav>
        </section>
      </BlockStack>
    </Page>
  );
}
```

**Accessibility Features:**
- Semantic HTML structure with proper headings
- ARIA landmarks and labels
- Screen reader announcements
- Keyboard navigation support
- Focus management
- High contrast support

## Specialized Components

### Subscription Components

#### useSubscriptions

WebSocket-based real-time subscriptions for collaborative features.

```typescript
const { 
  connectionState, 
  isConnected, 
  lastMessage, 
  subscribe, 
  unsubscribe, 
  reconnect 
} = useSubscriptions();
```

**Features:**
- Automatic reconnection
- Message queuing
- Connection state management
- Error handling
- Heartbeat monitoring

#### useRegistrySubscription

Registry-specific real-time updates.

```typescript
const { 
  registryData, 
  items, 
  customers, 
  activity, 
  isConnected 
} = useRegistrySubscription(registryId);
```

#### useShopSubscription

Shop-wide real-time updates.

```typescript
const { 
  analytics, 
  settings, 
  orders, 
  inventory, 
  isConnected 
} = useShopSubscription();
```

### Performance Components

#### usePredictivePrefetch

Intelligent resource preloading based on user behavior.

```typescript
const { 
  predictions, 
  prefetchRoute, 
  prefetchOnHover, 
  prefetchOnIdle, 
  getCachedData 
} = usePredictivePrefetch();
```

**Features:**
- Behavioral pattern analysis
- Intelligent route predictions
- Multiple prefetch strategies
- Cache management
- Performance analytics

#### PredictiveLink

Enhanced link component with predictive prefetching.

```typescript
interface PredictiveLinkProps {
  to: string;
  children: React.ReactNode;
  strategy?: PrefetchStrategy;
  priority?: PrefetchPriority;
  [key: string]: any;
}

function PredictiveLink(props: PredictiveLinkProps)
```

**Example:**

```typescript
import { PredictiveLink, PrefetchStrategy } from '~/lib/predictive-prefetch';

function Navigation() {
  return (
    <nav>
      <PredictiveLink 
        to="/admin/analytics" 
        strategy={PrefetchStrategy.ON_HOVER}
        priority={PrefetchPriority.HIGH}
      >
        Analytics
      </PredictiveLink>
    </nav>
  );
}
```

## Hooks and Utilities

### Accessibility Hooks

#### useContrastValidation

Validate color contrast ratios.

```typescript
const { 
  validateContrast, 
  validateColorPalette, 
  generateAccessiblePalette 
} = useContrastValidation();
```

#### useAccessibleColors

Get accessible color combinations.

```typescript
const { 
  getContrastColor, 
  getAccessiblePair 
} = useAccessibleColors();
```

#### useAccessibleAnimation

Respect user motion preferences.

```typescript
const { 
  getAnimationStyles, 
  reducedMotion 
} = useAccessibleAnimation();
```

### Performance Hooks

#### useHoverPrefetch

Prefetch on hover interaction.

```typescript
const { 
  onMouseEnter, 
  onMouseLeave 
} = useHoverPrefetch();
```

#### useIntersectionPrefetch

Prefetch when elements enter viewport.

```typescript
const { 
  observeElement, 
  unobserveElement 
} = useIntersectionPrefetch();
```

## Performance Components

### Service Worker Integration

Automatic service worker registration with caching strategies:

```typescript
// Built-in service worker features:
// - Cache-first strategy for static assets
// - Network-first for dynamic content
// - Stale-while-revalidate for API responses
// - Offline fallback pages
// - Push notifications support
```

### Bundle Optimization

Automatic code splitting and optimization:

```typescript
// vite.config.js configuration includes:
// - Manual chunk splitting
// - Tree shaking
// - Bundle analysis
// - Performance budgets
// - Critical CSS inlining
```

## Testing Components

### Screen Reader Testing

Comprehensive accessibility testing utilities:

```typescript
import { 
  setupScreenReaderTesting, 
  getScreenReaderEvents, 
  simulateScreenReaderNavigation 
} from '~/test/accessibility/screen-reader.test';
```

**Features:**
- Mock screen reader implementation
- ARIA live region monitoring
- Focus event tracking
- Keyboard navigation testing
- Automated accessibility checks

### Performance Testing

Performance monitoring and testing:

```typescript
import { 
  performanceMonitor, 
  measureCoreWebVitals, 
  trackUserInteraction 
} from '~/lib/performance-monitoring.client';
```

## Best Practices

### Accessibility Guidelines

1. **Always provide accessible names** for interactive elements
2. **Use semantic HTML** with proper heading hierarchy
3. **Implement keyboard navigation** for all interactive elements
4. **Provide screen reader announcements** for dynamic content changes
5. **Ensure sufficient color contrast** using ContrastValidator
6. **Test with actual assistive technologies** when possible

### Performance Guidelines

1. **Use predictive prefetching** for frequently accessed routes
2. **Implement proper caching strategies** for static and dynamic content
3. **Monitor Core Web Vitals** continuously
4. **Optimize bundle sizes** with code splitting
5. **Use semantic tokens** for consistent theming

### Code Organization

1. **Component Structure:**
   ```
   app/components/
   ├── ThemeProvider.tsx      # Theme management
   ├── ContrastValidator.tsx  # Accessibility validation
   └── [component]/
       ├── index.ts          # Exports
       ├── Component.tsx     # Main component
       ├── Component.test.tsx # Tests
       └── Component.stories.tsx # Storybook stories (if applicable)
   ```

2. **Hook Organization:**
   ```
   app/hooks/
   ├── useSubscriptions.ts    # WebSocket subscriptions
   ├── useTheme.ts           # Theme management
   └── useAccessibility.ts   # Accessibility utilities
   ```

3. **Utility Organization:**
   ```
   app/lib/
   ├── accessibility.ts      # Accessibility utilities
   ├── semantic-tokens.ts    # Theme tokens
   ├── predictive-prefetch.ts # Performance utilities
   └── graphql-subscriptions.server.ts # Real-time updates
   ```

## Examples

### Complete Accessible Form

```typescript
import { useState } from 'react';
import { TextField, Button, FormLayout, Banner } from '@shopify/polaris';
import { ContrastValidator } from '~/components/ContrastValidator';
import { generateAriaAttributes, formAccessibility } from '~/lib/accessibility';

function AccessibleRegistryForm() {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    primaryColor: '#008060',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    
    const newErrors: Record<string, string> = {};
    
    if (!formData.title) {
      newErrors.title = 'Registry title is required';
    }
    
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length === 0) {
      // Submit form
      console.log('Form submitted:', formData);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormLayout>
        {Object.keys(errors).length > 0 && (
          <Banner
            tone="critical"
            title="Please fix the following errors:"
            role="alert"
            aria-live="polite"
          >
            <ul>
              {Object.values(errors).map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </Banner>
        )}
        
        <TextField
          label="Registry Title"
          value={formData.title}
          onChange={(value) => setFormData({ ...formData, title: value })}
          error={errors.title}
          required
          {...formAccessibility.getFieldAttributes({
            id: 'registry-title',
            label: 'Registry Title',
            required: true,
            invalid: !!errors.title,
            error: errors.title,
          })}
        />
        
        <TextField
          label="Description"
          value={formData.description}
          onChange={(value) => setFormData({ ...formData, description: value })}
          multiline={4}
          helpText="Describe your registry to help gift-givers understand the occasion"
        />
        
        <div>
          <label htmlFor="primary-color">Primary Color</label>
          <input
            id="primary-color"
            type="color"
            value={formData.primaryColor}
            onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
            aria-describedby="primary-color-help"
          />
          <p id="primary-color-help">
            Choose a color that represents your registry theme
          </p>
          
          <ContrastValidator
            foregroundColor="#ffffff"
            backgroundColor={formData.primaryColor}
            showDetails={true}
          />
        </div>
        
        <Button
          submit
          variant="primary"
          accessibilityLabel="Create registry with the provided information"
        >
          Create Registry
        </Button>
      </FormLayout>
    </form>
  );
}
```

### Real-time Registry Updates

```typescript
import { useEffect, useState } from 'react';
import { Card, BlockStack, Text, Badge, Button } from '@shopify/polaris';
import { useRegistrySubscription } from '~/hooks/useSubscriptions';
import { announceToScreenReader } from '~/lib/accessibility';

function LiveRegistryView({ registryId }: { registryId: string }) {
  const { registryData, items, customers, activity, isConnected } = useRegistrySubscription(registryId);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Announce updates to screen readers
  useEffect(() => {
    if (activity.length > 0) {
      const latestActivity = activity[0];
      announceToScreenReader(
        `Registry updated: ${latestActivity.description}`,
        'polite'
      );
      setLastUpdate(new Date());
    }
  }, [activity]);

  return (
    <Card>
      <BlockStack gap="400">
        <div>
          <Text variant="headingMd" as="h2">
            {registryData?.title || 'Loading...'}
          </Text>
          <Badge tone={isConnected ? 'success' : 'critical'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>
        
        <div aria-live="polite" aria-atomic="true">
          <Text variant="bodySm" tone="subdued">
            {items.length} items • {customers.length} customers viewing
            {lastUpdate && ` • Last updated: ${lastUpdate.toLocaleTimeString()}`}
          </Text>
        </div>
        
        <div>
          <Text variant="headingSm" as="h3">Recent Activity</Text>
          <ul role="log" aria-live="polite" aria-label="Registry activity log">
            {activity.slice(0, 5).map((item, index) => (
              <li key={index}>
                <Text variant="bodySm">
                  {item.description} - {new Date(item.timestamp).toLocaleTimeString()}
                </Text>
              </li>
            ))}
          </ul>
        </div>
        
        <Button
          onClick={() => {
            // Refresh data
            announceToScreenReader('Registry data refreshed', 'polite');
          }}
          accessibilityLabel="Refresh registry data"
        >
          Refresh
        </Button>
      </BlockStack>
    </Card>
  );
}
```

### Performance-Optimized Navigation

```typescript
import { PredictiveLink, PrefetchStrategy, PrefetchPriority } from '~/lib/predictive-prefetch';
import { useResponsive } from '~/components/ThemeProvider';

function NavigationMenu() {
  const { isMobile } = useResponsive();
  
  return (
    <nav aria-label="Main navigation">
      <ul role="menubar">
        <li role="none">
          <PredictiveLink
            to="/admin/dashboard"
            strategy={PrefetchStrategy.ON_HOVER}
            priority={PrefetchPriority.HIGH}
            role="menuitem"
            aria-current="page"
          >
            Dashboard
          </PredictiveLink>
        </li>
        
        <li role="none">
          <PredictiveLink
            to="/admin/registries"
            strategy={isMobile ? PrefetchStrategy.ON_INTENT : PrefetchStrategy.ON_HOVER}
            priority={PrefetchPriority.MEDIUM}
            role="menuitem"
          >
            Registries
          </PredictiveLink>
        </li>
        
        <li role="none">
          <PredictiveLink
            to="/admin/analytics"
            strategy={PrefetchStrategy.ON_IDLE}
            priority={PrefetchPriority.LOW}
            role="menuitem"
          >
            Analytics
          </PredictiveLink>
        </li>
      </ul>
    </nav>
  );
}
```

## API Reference

For detailed API documentation, see the individual component files and their TypeScript interfaces. All components are fully typed and include comprehensive JSDoc comments.

## Contributing

When adding new components to the library:

1. Follow the accessibility guidelines
2. Use semantic tokens for theming
3. Include comprehensive tests
4. Add screen reader testing
5. Document all props and behaviors
6. Follow the established file structure

## Support

For questions about the component library, please refer to:
- Component source code and comments
- Test files for usage examples
- TypeScript interfaces for API documentation
- Accessibility utilities for implementation details