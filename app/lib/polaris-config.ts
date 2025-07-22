// Auto-generated Polaris optimization config
// This file reduces bundle size by providing minimal Polaris imports

// Only include essential components for initial load
export const ESSENTIAL_POLARIS_COMPONENTS = [
  'Page',
  'Card', 
  'Layout',
  'Text',
  'Button',
  'Spinner',
  'Banner'
];

// Heavy components to be loaded dynamically
export const DYNAMIC_POLARIS_COMPONENTS = [
  'DataTable',
  'ResourceList',
  'Filters', 
  'DatePicker',
  'Modal',
  'Sheet'
];

// Tree-shakeable import helper
export function importPolarisComponent(componentName: string) {
  return import('@shopify/polaris').then(module => module[componentName]);
}