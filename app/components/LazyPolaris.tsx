/**
 * Essential Polaris component exports
 * Simplified version - removed unused lazy loading system
 */

// Export essential components that are actually used
export { 
  Page, 
  Layout, 
  Card, 
  Text, 
  Button, 
  Spinner, 
  Banner,
  TextField,
  Modal,
  Toast
} from '@shopify/polaris';

// Export type definitions for TypeScript
export type {
  PageProps,
  LayoutProps,
  CardProps,
  TextProps,
  ButtonProps,
  BannerProps,
} from '@shopify/polaris';