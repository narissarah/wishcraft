# Shopify Functions

This directory will contain Shopify Functions for extending Shopify's native functionality.

## Planned Functions

1. **Registry Discount Function**
   - Apply automatic discounts for registry purchases
   - Volume discounts for multiple registry items

2. **Registry Fulfillment Function**
   - Custom fulfillment logic for gift registry orders
   - Automatic gift message handling

3. **Registry Validation Function**
   - Validate registry item availability
   - Custom inventory management for registry items

## Setup

Functions will be created using:
```bash
shopify app generate extension --type=function
```

Each function will have its own directory with:
- `shopify.function.extension.toml` - Configuration
- `src/` - Function source code
- `input.graphql` - Input schema
- `package.json` - Dependencies