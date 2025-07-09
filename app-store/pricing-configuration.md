# WishCraft Pricing and Billing Configuration

## Pricing Strategy Overview

### Market Positioning
- **Value-based pricing**: Aligned with revenue impact for merchants
- **Freemium model**: Free tier to drive adoption
- **Competitive pricing**: 20-30% below premium competitors
- **Transparent structure**: No hidden fees or transaction charges

### Pricing Psychology
- **3-tier structure**: Good, Better, Best options
- **Annual discount**: 20% savings for annual billing
- **Free trial**: 14 days, no credit card required
- **Usage-based value**: Plans scale with business size

## Pricing Plans

### Free Plan - $0/month
**Target**: Small businesses, new merchants, trial users
**Limits**:
- Up to 10 active registries per month
- Basic registry customization
- Standard email templates
- Community support only
- WishCraft branding included

**Features Included**:
- Registry creation and management
- Basic product search and adding
- Customer notifications
- Mobile-responsive registry pages
- Basic analytics (page views, conversions)
- Social media sharing
- Duplicate purchase prevention

**Upgrade Triggers**:
- Registry limit reached
- Need for advanced customization
- Require priority support
- Want to remove branding

### Pro Plan - $29/month ($279/year)
**Target**: Growing businesses, established merchants
**Limits**:
- Unlimited registries
- Advanced customization options
- Custom email templates
- Priority email support (24-hour response)
- WishCraft branding removable

**Features Included**:
- Everything in Free Plan
- Group gifting functionality
- Advanced analytics dashboard
- Custom registry themes
- Bulk registry management
- Multi-address shipping coordination
- Advanced notification settings
- Registry import/export
- API access (basic)
- Custom CSS styling

**Value Proposition**:
- Typically pays for itself with 1-2 large registry orders
- Advanced features drive 35% higher conversion rates
- Priority support ensures quick issue resolution

### Enterprise Plan - $99/month ($999/year)
**Target**: High-volume merchants, multi-store operations
**Limits**:
- Everything unlimited
- White-label solution
- Dedicated account manager
- SLA-backed support (4-hour response)
- Custom development available

**Features Included**:
- Everything in Pro Plan
- Multi-store management
- Advanced API access
- Custom integrations
- Dedicated onboarding
- Priority feature requests
- Advanced security features
- Custom reporting
- Dedicated infrastructure
- Professional services

**Value Proposition**:
- Enterprise-grade reliability and support
- Custom solutions for unique business needs
- Dedicated success management
- Priority access to new features

## Billing Configuration

### Shopify Billing API Integration

```javascript
// Billing API configuration
const billingConfig = {
  plans: [
    {
      name: 'WishCraft Free',
      price: 0,
      interval: 'EVERY_30_DAYS',
      trial_days: 0,
      test: false
    },
    {
      name: 'WishCraft Pro',
      price: 29.00,
      interval: 'EVERY_30_DAYS', 
      trial_days: 14,
      test: false
    },
    {
      name: 'WishCraft Pro Annual',
      price: 279.00,
      interval: 'ANNUAL',
      trial_days: 14,
      test: false
    },
    {
      name: 'WishCraft Enterprise',
      price: 99.00,
      interval: 'EVERY_30_DAYS',
      trial_days: 14,
      test: false
    },
    {
      name: 'WishCraft Enterprise Annual',
      price: 999.00,
      interval: 'ANNUAL',
      trial_days: 14,
      test: false
    }
  ]
};
```

### Usage Tracking

```javascript
// Usage tracking for plan limits
const usageTracking = {
  free: {
    registriesLimit: 10,
    features: ['basic_registry', 'email_notifications', 'mobile_responsive'],
    support: 'community'
  },
  pro: {
    registriesLimit: null, // unlimited
    features: ['group_gifting', 'advanced_analytics', 'custom_themes', 'api_basic'],
    support: 'priority_email'
  },
  enterprise: {
    registriesLimit: null,
    features: ['multi_store', 'advanced_api', 'custom_integrations', 'white_label'],
    support: 'dedicated_manager'
  }
};
```

## Revenue Model Analysis

### Revenue Projections (Year 1)

**Month 1-3 (Launch Phase)**:
- Free users: 100 installs
- Pro users: 10 conversions (10%)
- Enterprise users: 1 conversion (1%)
- Monthly Revenue: $398

**Month 4-6 (Growth Phase)**:
- Free users: 500 installs
- Pro users: 75 conversions (15%)
- Enterprise users: 5 conversions (1%)
- Monthly Revenue: $2,670

**Month 7-12 (Scale Phase)**:
- Free users: 2,000 installs
- Pro users: 400 conversions (20%)
- Enterprise users: 20 conversions (1%)
- Monthly Revenue: $13,580

**Year 1 Total Revenue**: $98,400
**Year 2 Projection**: $350,000
**Year 3 Projection**: $750,000

### Unit Economics

**Customer Acquisition Cost (CAC)**:
- Free users: $15 (marketing cost)
- Pro users: $45 (includes free user conversion cost)
- Enterprise users: $200 (sales and marketing)

**Lifetime Value (LTV)**:
- Pro users: $580 (20-month average retention)
- Enterprise users: $2,376 (24-month average retention)

**LTV/CAC Ratios**:
- Pro: 12.9x (excellent)
- Enterprise: 11.9x (excellent)

## Billing Implementation

### Subscription Management

```javascript
// app/lib/billing.server.ts
export class BillingManager {
  async createSubscription(shop, plan) {
    const subscription = await shopify.billing.request({
      recurring_charge: {
        name: plan.name,
        price: plan.price,
        trial_days: plan.trial_days,
        return_url: `${process.env.HOST}/billing/callback`
      }
    });
    
    return subscription;
  }
  
  async handleBillingCallback(shop, charge_id) {
    const charge = await shopify.billing.get(charge_id);
    
    if (charge.status === 'accepted') {
      await this.activateSubscription(shop, charge);
    }
    
    return charge;
  }
  
  async checkUsageLimits(shop, action) {
    const subscription = await this.getActiveSubscription(shop);
    const usage = await this.getCurrentUsage(shop);
    
    return this.validateUsage(subscription.plan, usage, action);
  }
}
```

### Usage Enforcement

```javascript
// app/lib/usage-limits.server.ts
export class UsageLimits {
  static async enforceRegistryLimit(shop) {
    const plan = await this.getCurrentPlan(shop);
    const activeRegistries = await this.getActiveRegistryCount(shop);
    
    if (plan.registriesLimit && activeRegistries >= plan.registriesLimit) {
      throw new Error('Registry limit reached. Please upgrade to continue.');
    }
  }
  
  static async enforceFeatureAccess(shop, feature) {
    const plan = await this.getCurrentPlan(shop);
    
    if (!plan.features.includes(feature)) {
      throw new Error(`Feature ${feature} requires plan upgrade.`);
    }
  }
}
```

## Pricing Page Implementation

### Plan Comparison Table

```jsx
// app/components/PricingTable.tsx
export function PricingTable() {
  return (
    <Card>
      <Layout>
        <Layout.Section>
          <div className="pricing-grid">
            {plans.map(plan => (
              <PricingCard 
                key={plan.id}
                plan={plan}
                isPopular={plan.id === 'pro'}
                onSelect={() => selectPlan(plan)}
              />
            ))}
          </div>
        </Layout.Section>
      </Layout>
    </Card>
  );
}
```

### Feature Matrix

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Active Registries | 10 | Unlimited | Unlimited |
| Group Gifting | ❌ | ✅ | ✅ |
| Custom Themes | ❌ | ✅ | ✅ |
| Advanced Analytics | ❌ | ✅ | ✅ |
| API Access | ❌ | Basic | Advanced |
| White Label | ❌ | ❌ | ✅ |
| Multi-Store | ❌ | ❌ | ✅ |
| Support | Community | Priority | Dedicated |
| SLA | None | 24hrs | 4hrs |

## Payment Processing

### Supported Payment Methods
- **Credit Cards**: Visa, MasterCard, American Express
- **Digital Wallets**: PayPal, Apple Pay, Google Pay
- **Bank Transfers**: ACH (US), SEPA (EU), Wire transfers
- **Crypto**: Bitcoin, Ethereum (Enterprise only)

### Tax Handling
- **Automatic tax calculation** based on merchant location
- **VAT compliance** for EU merchants
- **GST handling** for Australian/Canadian merchants
- **Tax exemption** processing for qualifying businesses

### Currency Support
- **USD**: Primary currency for all plans
- **EUR**: European market pricing
- **GBP**: UK market pricing
- **CAD**: Canadian market pricing
- **AUD**: Australian market pricing

## Subscription Analytics

### Key Metrics to Track
- **Monthly Recurring Revenue (MRR)**
- **Annual Recurring Revenue (ARR)**
- **Customer Acquisition Cost (CAC)**
- **Lifetime Value (LTV)**
- **Churn Rate**
- **Conversion Rate** (Free to Paid)
- **Upgrade Rate** (Pro to Enterprise)
- **Usage by Plan**

### Billing Dashboard

```jsx
// app/routes/admin.billing.tsx
export function BillingDashboard() {
  const { subscription, usage, metrics } = useLoaderData();
  
  return (
    <Page title="Billing & Usage">
      <Layout>
        <Layout.Section>
          <Card title="Current Plan">
            <PlanDetails subscription={subscription} />
          </Card>
        </Layout.Section>
        
        <Layout.Section>
          <Card title="Usage This Month">
            <UsageMetrics usage={usage} />
          </Card>
        </Layout.Section>
        
        <Layout.Section>
          <Card title="Billing History">
            <BillingHistory />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
```

## Pricing Optimization Strategy

### A/B Testing Plans
1. **Price Points**: Test $24 vs $29 vs $34 for Pro plan
2. **Trial Periods**: Test 7-day vs 14-day vs 30-day trials
3. **Feature Bundling**: Test different feature combinations
4. **Discount Strategies**: Test annual discounts 15% vs 20% vs 25%

### Competitive Analysis
- **Competitor A**: $39/month, fewer features
- **Competitor B**: $25/month, limited integrations
- **Competitor C**: $45/month, enterprise focus
- **Our Advantage**: Better value proposition at $29/month

### Value Communication
- **ROI Calculator**: Show potential revenue increase
- **Case Studies**: Real merchant success stories
- **Feature Benefits**: Quantified impact of each feature
- **Comparison Charts**: Clear differentiation from competitors

---

**Implementation Timeline**:
- Week 1: Billing API integration
- Week 2: Usage tracking and limits
- Week 3: Pricing page and upgrade flows
- Week 4: Testing and optimization

**Success Metrics**:
- 15% free-to-paid conversion rate
- $50k ARR within 6 months
- 3.5% monthly churn rate
- 12+ months average customer lifetime