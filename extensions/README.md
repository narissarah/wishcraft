# Shopify Extensions

This directory contains all Shopify app extensions for WishCraft.

## Extensions Structure

### Theme Extension (`theme-extension/`)
- **Purpose**: Integrates registry functionality into the storefront
- **Components**: App blocks and embed blocks for themes
- **Features**:
  - Registry widget for product pages
  - Registry list display
  - Add to registry buttons
  - Registry sharing functionality

### Admin Extension (`admin-extension/`)
- **Purpose**: Extends the Shopify admin interface (if needed)
- **Components**: Admin UI extensions for registry management
- **Features**:
  - Advanced registry analytics
  - Bulk registry operations
  - Custom admin workflows

## Creating Extensions

Use the Shopify CLI to generate extensions:

```bash
# Create theme extension
shopify app generate extension --type=theme_app_extension

# Create admin extension
shopify app generate extension --type=admin_link
```

## Development

Extensions can be developed and previewed using:

```bash
# Start extension development
shopify app dev

# Preview specific extension
shopify app dev --theme-extension-port=9090
```