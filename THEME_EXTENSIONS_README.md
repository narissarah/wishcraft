# WishCraft Theme App Extensions

Complete documentation for the WishCraft Gift Registry Theme App Extensions that provide native storefront integration.

## 🎯 Overview

The WishCraft Theme App Extensions provide seamless, native integration with any Shopify Online Store 2.0 theme. These extensions allow customers to add products to registries, view and share registries, and purchase gifts directly from the storefront without theme modifications.

## 📁 Extension Structure

```
extensions/theme-extension/
├── shopify.extension.toml          # Extension configuration
├── blocks/                         # App blocks for theme editor
│   ├── add-to-registry.liquid     # Product page "Add to Registry" block
│   ├── registry-list.liquid       # Registry viewing and purchase block
│   └── registry-seo.liquid        # SEO and analytics embed block
├── assets/                         # Stylesheets and JavaScript
│   ├── wishcraft-registry.js      # Core JavaScript functionality
│   ├── wishcraft-add-to-registry.css
│   ├── wishcraft-registry-list.css
│   └── wishcraft-mobile.css       # Mobile-responsive styles
└── snippets/                       # Reusable Liquid snippets (future)
```

## 🧩 App Blocks

### 1. Add to Registry (`add-to-registry.liquid`)

**Purpose**: Allows customers to add products to their gift registries from product pages.

**Target**: `section` (can be added to any section in theme editor)

**Key Features**:
- Registry selection dropdown
- Variant selection for multi-variant products
- Quantity selector with +/- controls
- Priority selection (low, medium, high)
- Notes field for personal messages
- Login prompt for non-authenticated users
- Mobile-responsive design
- Accessibility compliant

**Usage**:
```liquid
<!-- Automatically available in theme editor -->
<!-- Merchants can add to product page sections -->
```

**Settings**:
- Title and description customization
- Button text and colors
- Feature toggles (priority, notes, etc.)
- Login messaging

### 2. Registry List (`registry-list.liquid`)

**Purpose**: Displays registry items for viewing and purchasing by gift givers.

**Target**: `section` (can be added to pages, home, etc.)

**Key Features**:
- Registry item grid layout
- Progress indicators for each item
- Purchase buttons with cart integration
- Social sharing buttons
- Filter and sort options
- Group gifting support
- Mobile-optimized interface
- SEO-friendly markup

**Usage**:
```liquid
<!-- Add to any page via theme editor -->
<!-- Configure registry ID in block settings -->
```

**Settings**:
- Registry ID configuration
- Layout options (items per row, image ratios)
- Display toggles (header, progress, sharing)
- Color customization
- Purchase flow options

### 3. Registry SEO (`registry-seo.liquid`)

**Purpose**: Adds SEO meta tags, structured data, and analytics tracking.

**Target**: `head` (App Embed Block)

**Key Features**:
- Open Graph and Twitter Card meta tags
- Schema.org structured data (ItemList, Event)
- Google Analytics integration
- Performance monitoring (Core Web Vitals)
- Social media tracking pixels
- Canonical URL management

**Usage**:
```liquid
<!-- Enabled in theme editor App Embeds section -->
<!-- Automatically adds SEO and tracking to registry pages -->
```

**Settings**:
- SEO content configuration
- Analytics toggles
- Structured data options
- Performance monitoring

## 🎨 Styling System

### CSS Architecture

**Mobile-First Approach**:
- Base styles optimized for mobile devices
- Progressive enhancement for tablets and desktop
- Touch-friendly interfaces with 44px minimum touch targets
- Responsive grid system using CSS Grid and Flexbox

**CSS Custom Properties**:
```css
:root {
  --primary-color: #000000;
  --text-color: #333333;
  --border-radius: 0.5rem;
  --spacing-md: 1rem;
  /* Configurable via theme settings */
}
```

**Component-Scoped Styles**:
- Each block has its own stylesheet
- No global style conflicts
- Theme-agnostic design
- Dark mode support via `prefers-color-scheme`

### Responsive Breakpoints

| Breakpoint | Range | Layout |
|------------|--------|---------|
| Mobile S   | < 375px | Single column, compact |
| Mobile     | 375px - 640px | Single column, standard |
| Tablet     | 641px - 1024px | 2-3 columns |
| Desktop    | 1025px+ | 4+ columns, enhanced hover |

## 🔧 JavaScript Functionality

### Core Architecture

**Modular Design**:
```javascript
window.WishCraftRegistry = {
  initAddToRegistry(blockId),
  initRegistryList(blockId),
  utils: { /* utility functions */ },
  RegistryAPI: { /* API wrapper */ }
};
```

**Key Classes**:

1. **AddToRegistryComponent**
   - Handles form validation and submission
   - Manages registry selection
   - Integrates with Shopify checkout
   - Provides real-time feedback

2. **RegistryListComponent**
   - Renders registry items dynamically
   - Handles purchase flow
   - Manages filtering and sorting
   - Tracks user interactions

3. **RegistryAPI**
   - Wraps app proxy API calls
   - Handles authentication
   - Provides error handling and retries
   - Manages request/response formatting

### API Integration

**App Proxy Routes**:
```
/apps/wishcraft/api/registries        # GET: List registries
/apps/wishcraft/api/registry          # GET: Get registry details
/apps/wishcraft/api/registry/items    # POST: Add item to registry
/apps/wishcraft/api/registry/share    # POST: Share registry
/apps/wishcraft/api/analytics/track   # POST: Track events
```

**Authentication**:
- Uses Shopify Customer Account API
- Session-based authentication
- Automatic login prompts
- Guest access for public registries

## 📱 Mobile Optimization

### Touch-First Design

**Touch Targets**:
- Minimum 44px for all interactive elements
- Adequate spacing between touch areas
- Visual feedback for touch interactions
- Swipe gestures where appropriate

**Performance**:
- Lazy loading for images
- Debounced user interactions
- Minimal JavaScript payload
- CSS-only animations where possible

**Accessibility**:
- WCAG 2.1 AA compliant
- Screen reader compatible
- Keyboard navigation support
- High contrast mode support
- Reduced motion preferences

## 🔍 SEO Implementation

### Meta Tags

**Standard SEO**:
```html
<meta name="description" content="...">
<meta name="keywords" content="...">
<link rel="canonical" href="...">
```

**Social Media**:
```html
<meta property="og:title" content="...">
<meta property="og:description" content="...">
<meta property="og:image" content="...">
<meta name="twitter:card" content="summary_large_image">
```

### Structured Data

**Schema.org Implementation**:
```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Registry Title",
  "description": "Registry Description",
  "creator": { "@type": "Person", "name": "..." }
}
```

**Benefits**:
- Rich snippets in search results
- Better social media previews
- Enhanced search visibility
- Voice assistant compatibility

## 📊 Analytics & Tracking

### Built-in Analytics

**Registry Metrics**:
- Page views and unique visitors
- Time on page and scroll depth
- Item interactions and clicks
- Purchase conversions
- Share tracking by platform

**Performance Monitoring**:
- Core Web Vitals (LCP, FID, CLS)
- Page load times
- JavaScript error tracking
- User flow analysis

### Third-Party Integrations

**Supported Platforms**:
- Google Analytics 4
- Facebook Pixel
- Pinterest Analytics
- Shopify Analytics
- Custom tracking solutions

## 🚀 Installation & Configuration

### 1. Deploy Theme Extension

```bash
# Deploy to development store
shopify app dev

# Deploy to production
shopify app deploy
```

### 2. Configure App Proxy

**Partner Dashboard Settings**:
- Subpath: `/apps/wishcraft`
- Backend URL: `https://your-app.com/apps/wishcraft/api`

### 3. Theme Editor Setup

**For Merchants**:
1. Go to Online Store > Themes > Customize
2. Add App Blocks to desired sections:
   - Product pages: Add "Add to Registry" block
   - Registry pages: Add "Registry List" block
3. Enable App Embeds:
   - "Registry SEO & Analytics" in App Embeds section

### 4. App Block Configuration

**Add to Registry Block**:
```liquid
<!-- Product page integration -->
{{ 'wishcraft-add-to-registry.css' | asset_url | stylesheet_tag }}
{{ 'wishcraft-registry.js' | asset_url | script_tag }}
```

**Registry List Block**:
```liquid
<!-- Registry viewing page -->
{{ 'wishcraft-registry-list.css' | asset_url | stylesheet_tag }}
{{ 'wishcraft-mobile.css' | asset_url | stylesheet_tag }}
```

## 🔧 Customization

### Theme Integration

**CSS Custom Properties**:
```css
.wishcraft-add-to-registry {
  --button-bg: {{ settings.primary_color }};
  --text-color: {{ settings.text_color }};
  --border-radius: {{ settings.border_radius }};
}
```

**Liquid Template Integration**:
```liquid
{% comment %} Access theme settings {% endcomment %}
style="--primary-color: {{ settings.accent_color }};"

{% comment %} Conditional loading {% endcomment %}
{% if block.settings.enable_registry %}
  {{ 'wishcraft-registry.css' | asset_url | stylesheet_tag }}
{% endif %}
```

### JavaScript Customization

**Event Hooks**:
```javascript
// Custom analytics tracking
window.WishCraftRegistry.onAddToRegistry = function(data) {
  // Custom tracking logic
  yourAnalytics.track('registry_add', data);
};

// Custom UI modifications
window.WishCraftRegistry.onRegistryLoad = function(registry) {
  // Custom registry display logic
  customizeRegistryDisplay(registry);
};
```

## 🧪 Testing

### Browser Testing

**Supported Browsers**:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile Safari iOS 14+
- Chrome Mobile Android 90+

### Device Testing

**Responsive Breakpoints**:
- iPhone SE (375px)
- iPhone 12 (390px)
- iPad (768px)
- iPad Pro (1024px)
- Desktop (1440px+)

### Accessibility Testing

**Tools**:
- axe-core automated testing
- Screen reader compatibility (NVDA, JAWS, VoiceOver)
- Keyboard navigation testing
- Color contrast validation

## 🔒 Security Considerations

### Data Protection

**Customer Data**:
- Minimal data collection
- GDPR compliance built-in
- Secure session management
- No sensitive data in client-side code

**API Security**:
- HMAC signature verification
- Rate limiting implemented
- Input sanitization
- XSS protection

## 🎯 Performance Optimization

### Loading Strategy

**Critical Path**:
1. CSS loads inline for above-fold content
2. JavaScript loads asynchronously
3. Images lazy load below fold
4. Third-party scripts load last

**Bundle Optimization**:
- Tree-shaking for unused code
- CSS minification and compression
- JavaScript compression
- Image optimization

### Caching Strategy

**Browser Caching**:
- CSS/JS files: 1 year cache
- API responses: Short-term cache
- Images: Long-term cache with versioning

## 🚨 Troubleshooting

### Common Issues

**App Block Not Appearing**:
1. Verify Online Store 2.0 theme
2. Check app installation status
3. Confirm app proxy configuration
4. Clear browser cache

**JavaScript Errors**:
1. Check console for error messages
2. Verify app proxy routes are working
3. Test with different browsers
4. Disable conflicting apps temporarily

**Styling Issues**:
1. Check CSS custom property inheritance
2. Verify theme CSS doesn't override app styles
3. Test with default theme
4. Check for CSS conflicts

### Debug Mode

```javascript
// Enable debug mode
localStorage.setItem('wishcraft_debug', 'true');

// Check component initialization
console.log(window.WishCraftRegistry.components);

// Test API connectivity
window.WishCraftRegistry.utils.fetchWithRetry('/apps/wishcraft/api/registries')
  .then(console.log)
  .catch(console.error);
```

## 📈 Future Enhancements

### Planned Features

**Enhanced UI**:
- Drag-and-drop item reordering
- Advanced filtering options
- Registry templates
- Wishlist comparisons

**Advanced Analytics**:
- Conversion funnel analysis
- A/B testing framework
- Predictive analytics
- Customer journey mapping

**Extended Integrations**:
- Social media APIs
- Email marketing platforms
- Inventory management systems
- Multi-language support

## 📞 Support

### Documentation Resources

- [Shopify Theme App Extensions](https://shopify.dev/docs/apps/online-store/theme-app-extensions)
- [Online Store 2.0 Themes](https://shopify.dev/docs/themes/architecture)
- [Polaris Design System](https://polaris.shopify.com/)

### Getting Help

1. Check this documentation first
2. Review browser console for errors
3. Test with default theme to isolate issues
4. Contact support with detailed error information

---

## ✅ Implementation Checklist

- [x] **Add to Registry Block**: Complete with form validation, accessibility, and mobile optimization
- [x] **Registry List Block**: Full viewing interface with purchase flow and social sharing
- [x] **SEO & Analytics Block**: Comprehensive meta tags, structured data, and tracking
- [x] **Mobile-Responsive Design**: Touch-optimized interface across all device sizes
- [x] **App Proxy Integration**: Secure API endpoints for storefront functionality
- [x] **JavaScript Framework**: Modular, performant code with error handling
- [x] **CSS Architecture**: Scalable, theme-agnostic styling system
- [x] **Accessibility**: WCAG 2.1 AA compliant with keyboard navigation
- [x] **Performance**: Optimized loading, caching, and Core Web Vitals
- [x] **Documentation**: Comprehensive setup and customization guides

The WishCraft Theme App Extensions provide a complete, production-ready solution for gift registry functionality that integrates seamlessly with any Shopify Online Store 2.0 theme while maintaining optimal performance, accessibility, and user experience across all devices.