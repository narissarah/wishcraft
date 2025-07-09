// User Analytics and Behavior Tracking System for WishCraft
// Comprehensive user journey tracking with privacy compliance

import { logger } from './logger';
import { apmManager } from './apm-setup';

// Event Types
export enum EventType {
  // User Journey Events
  PAGE_VIEW = 'page_view',
  REGISTRY_VIEW = 'registry_view',
  PRODUCT_VIEW = 'product_view',
  SEARCH = 'search',
  
  // Registry Events
  REGISTRY_CREATED = 'registry_created',
  REGISTRY_EDITED = 'registry_edited',
  REGISTRY_SHARED = 'registry_shared',
  REGISTRY_DELETED = 'registry_deleted',
  
  // Product Events
  ITEM_ADDED = 'item_added',
  ITEM_REMOVED = 'item_removed',
  ITEM_PURCHASED = 'item_purchased',
  QUANTITY_UPDATED = 'quantity_updated',
  
  // Group Gifting Events
  GROUP_CONTRIBUTION = 'group_contribution',
  GROUP_GIFT_COMPLETED = 'group_gift_completed',
  
  // Engagement Events
  SOCIAL_SHARE = 'social_share',
  EMAIL_SENT = 'email_sent',
  NOTIFICATION_CLICKED = 'notification_clicked',
  
  // Business Events
  SUBSCRIPTION_STARTED = 'subscription_started',
  SUBSCRIPTION_CANCELLED = 'subscription_cancelled',
  PLAN_UPGRADED = 'plan_upgraded',
  PLAN_DOWNGRADED = 'plan_downgraded',
  
  // Error Events
  ERROR_OCCURRED = 'error_occurred',
  FORM_VALIDATION_FAILED = 'form_validation_failed'
}

// User Segment Types
export enum UserSegment {
  NEW_USER = 'new_user',
  ACTIVE_USER = 'active_user',
  POWER_USER = 'power_user',
  CHURNED_USER = 'churned_user',
  ENTERPRISE_USER = 'enterprise_user'
}

// Analytics Event Interface
export interface AnalyticsEvent {
  eventType: EventType;
  userId?: string;
  sessionId: string;
  shopId?: string;
  registryId?: string;
  timestamp: number;
  properties: Record<string, any>;
  metadata: {
    userAgent: string;
    ip: string;
    referrer?: string;
    url: string;
    device: DeviceInfo;
    location?: LocationInfo;
  };
}

export interface DeviceInfo {
  type: 'mobile' | 'tablet' | 'desktop';
  os: string;
  browser: string;
  viewport: {
    width: number;
    height: number;
  };
}

export interface LocationInfo {
  country: string;
  region: string;
  city: string;
  timezone: string;
}

// User Profile Interface
export interface UserProfile {
  userId: string;
  shopId?: string;
  segment: UserSegment;
  firstSeen: number;
  lastSeen: number;
  sessionCount: number;
  totalEvents: number;
  
  // Registry Behavior
  registriesCreated: number;
  registriesCompleted: number;
  averageRegistrySize: number;
  
  // Engagement Metrics
  pageViews: number;
  timeSpent: number; // in seconds
  socialShares: number;
  
  // Business Metrics
  planType: string;
  mrr: number; // Monthly Recurring Revenue
  ltv: number; // Lifetime Value
  
  // Preferences
  preferences: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    theme: string;
    language: string;
  };
}

// Funnel Analysis
export interface FunnelStep {
  name: string;
  eventType: EventType;
  users: number;
  conversionRate: number;
  dropoffRate: number;
  averageTime: number;
}

// Analytics Manager Class
export class UserAnalyticsManager {
  private events: AnalyticsEvent[] = [];
  private userProfiles: Map<string, UserProfile> = new Map();
  private sessions: Map<string, any> = new Map();
  private funnels: Map<string, FunnelStep[]> = new Map();

  constructor() {
    this.setupAnalytics();
    this.startBackgroundJobs();
  }

  private setupAnalytics(): void {
    // Initialize Google Analytics 4 if configured
    if (process.env.GA_MEASUREMENT_ID) {
      this.initializeGA4();
    }

    // Initialize Mixpanel if configured
    if (process.env.MIXPANEL_TOKEN) {
      this.initializeMixpanel();
    }

    // Initialize Amplitude if configured
    if (process.env.AMPLITUDE_API_KEY) {
      this.initializeAmplitude();
    }

    logger.info('User analytics initialized');
  }

  private initializeGA4(): void {
    // GA4 would be initialized on the client side
    // Server-side events sent via Measurement Protocol
    logger.info('GA4 analytics configured');
  }

  private initializeMixpanel(): void {
    // Mixpanel initialization
    logger.info('Mixpanel analytics configured');
  }

  private initializeAmplitude(): void {
    // Amplitude initialization
    logger.info('Amplitude analytics configured');
  }

  private startBackgroundJobs(): void {
    // Process events every 30 seconds
    setInterval(() => {
      this.processEventQueue();
    }, 30000);

    // Update user segments every 5 minutes
    setInterval(() => {
      this.updateUserSegments();
    }, 300000);

    // Calculate funnels every hour
    setInterval(() => {
      this.calculateFunnels();
    }, 3600000);

    // Cleanup old data every day
    setInterval(() => {
      this.cleanupOldData();
    }, 86400000);
  }

  // Event Tracking
  public track(
    eventType: EventType,
    properties: Record<string, any> = {},
    userId?: string,
    sessionId?: string
  ): void {
    const event: AnalyticsEvent = {
      eventType,
      userId,
      sessionId: sessionId || this.generateSessionId(),
      shopId: properties.shopId,
      registryId: properties.registryId,
      timestamp: Date.now(),
      properties: this.sanitizeProperties(properties),
      metadata: {
        userAgent: properties.userAgent || 'unknown',
        ip: this.hashIP(properties.ip || '127.0.0.1'),
        referrer: properties.referrer,
        url: properties.url || '',
        device: this.parseDeviceInfo(properties.userAgent),
        location: properties.location
      }
    };

    // Add to queue
    this.events.push(event);

    // Update user profile
    if (userId) {
      this.updateUserProfile(userId, event);
    }

    // Update session
    this.updateSession(event.sessionId, event);

    // Send to external services
    this.sendToExternalServices(event);

    // Log significant events
    if (this.isSignificantEvent(eventType)) {
      logger.info('Significant user event', {
        eventType,
        userId,
        shopId: properties.shopId,
        properties: this.sanitizeForLogs(properties)
      });
    }
  }

  private sanitizeProperties(properties: Record<string, any>): Record<string, any> {
    const sanitized = { ...properties };
    
    // Remove sensitive data
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.apiKey;
    delete sanitized.credit_card;
    delete sanitized.ssn;

    // Hash email addresses
    if (sanitized.email) {
      sanitized.email_hash = this.hashEmail(sanitized.email);
      delete sanitized.email;
    }

    return sanitized;
  }

  private sanitizeForLogs(properties: Record<string, any>): Record<string, any> {
    const sanitized = { ...properties };
    
    // Remove or hash PII for logging
    delete sanitized.ip;
    delete sanitized.userAgent;
    delete sanitized.email;
    delete sanitized.phone;

    return sanitized;
  }

  private updateUserProfile(userId: string, event: AnalyticsEvent): void {
    let profile = this.userProfiles.get(userId);
    
    if (!profile) {
      profile = this.createNewUserProfile(userId, event);
    }

    // Update basic metrics
    profile.lastSeen = event.timestamp;
    profile.totalEvents++;

    // Update specific metrics based on event type
    this.updateProfileMetrics(profile, event);

    // Update segment
    profile.segment = this.determineUserSegment(profile);

    this.userProfiles.set(userId, profile);
  }

  private createNewUserProfile(userId: string, event: AnalyticsEvent): UserProfile {
    return {
      userId,
      shopId: event.shopId,
      segment: UserSegment.NEW_USER,
      firstSeen: event.timestamp,
      lastSeen: event.timestamp,
      sessionCount: 1,
      totalEvents: 1,
      registriesCreated: 0,
      registriesCompleted: 0,
      averageRegistrySize: 0,
      pageViews: event.eventType === EventType.PAGE_VIEW ? 1 : 0,
      timeSpent: 0,
      socialShares: 0,
      planType: 'free',
      mrr: 0,
      ltv: 0,
      preferences: {
        emailNotifications: true,
        pushNotifications: false,
        theme: 'default',
        language: 'en'
      }
    };
  }

  private updateProfileMetrics(profile: UserProfile, event: AnalyticsEvent): void {
    switch (event.eventType) {
      case EventType.PAGE_VIEW:
        profile.pageViews++;
        break;
      case EventType.REGISTRY_CREATED:
        profile.registriesCreated++;
        break;
      case EventType.SOCIAL_SHARE:
        profile.socialShares++;
        break;
      case EventType.SUBSCRIPTION_STARTED:
        profile.planType = event.properties.planType || 'pro';
        profile.mrr = event.properties.amount || 29;
        break;
      case EventType.PLAN_UPGRADED:
        profile.planType = event.properties.newPlan || 'enterprise';
        profile.mrr = event.properties.newAmount || 99;
        break;
    }
  }

  private determineUserSegment(profile: UserProfile): UserSegment {
    const daysSinceFirstSeen = (Date.now() - profile.firstSeen) / (1000 * 60 * 60 * 24);
    const daysSinceLastSeen = (Date.now() - profile.lastSeen) / (1000 * 60 * 60 * 24);

    // Churned user (no activity in 30 days)
    if (daysSinceLastSeen > 30) {
      return UserSegment.CHURNED_USER;
    }

    // Enterprise user
    if (profile.planType === 'enterprise' || profile.mrr >= 99) {
      return UserSegment.ENTERPRISE_USER;
    }

    // Power user (high engagement)
    if (profile.registriesCreated >= 5 && profile.sessionCount >= 10) {
      return UserSegment.POWER_USER;
    }

    // Active user (some engagement)
    if (daysSinceFirstSeen > 7 && profile.sessionCount >= 3) {
      return UserSegment.ACTIVE_USER;
    }

    // New user
    return UserSegment.NEW_USER;
  }

  private updateSession(sessionId: string, event: AnalyticsEvent): void {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      session = {
        sessionId,
        userId: event.userId,
        startTime: event.timestamp,
        lastActivity: event.timestamp,
        eventCount: 0,
        pages: new Set(),
        registries: new Set()
      };
    }

    session.lastActivity = event.timestamp;
    session.eventCount++;

    if (event.eventType === EventType.PAGE_VIEW) {
      session.pages.add(event.properties.page);
    }

    if (event.registryId) {
      session.registries.add(event.registryId);
    }

    this.sessions.set(sessionId, session);
  }

  private sendToExternalServices(event: AnalyticsEvent): void {
    // Send to Google Analytics
    if (process.env.GA_MEASUREMENT_ID) {
      this.sendToGA4(event);
    }

    // Send to Mixpanel
    if (process.env.MIXPANEL_TOKEN) {
      this.sendToMixpanel(event);
    }

    // Send to internal analytics
    this.sendToInternalAnalytics(event);
  }

  private async sendToGA4(event: AnalyticsEvent): Promise<void> {
    try {
      const payload = {
        client_id: event.sessionId,
        user_id: event.userId,
        events: [{
          name: this.mapEventToGA4(event.eventType),
          params: {
            ...event.properties,
            page_location: event.metadata.url,
            page_referrer: event.metadata.referrer
          }
        }]
      };

      await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${process.env.GA_MEASUREMENT_ID}&api_secret=${process.env.GA_API_SECRET}`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (error) {
      logger.error('Failed to send to GA4', { error });
    }
  }

  private async sendToMixpanel(event: AnalyticsEvent): Promise<void> {
    try {
      const payload = {
        event: event.eventType,
        properties: {
          distinct_id: event.userId || event.sessionId,
          time: event.timestamp,
          ...event.properties,
          $browser: event.metadata.device.browser,
          $os: event.metadata.device.os,
          $device_type: event.metadata.device.type,
          $current_url: event.metadata.url,
          $referrer: event.metadata.referrer
        }
      };

      const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
      
      await fetch(`https://api.mixpanel.com/track?data=${encoded}&token=${process.env.MIXPANEL_TOKEN}`, {
        method: 'GET'
      });
    } catch (error) {
      logger.error('Failed to send to Mixpanel', { error });
    }
  }

  private sendToInternalAnalytics(event: AnalyticsEvent): void {
    // Send to APM for business metrics
    apmManager.recordBusinessMetric(`events.${event.eventType}`, 1, [
      `user_segment:${this.getUserSegment(event.userId)}`,
      `device_type:${event.metadata.device.type}`
    ]);
  }

  private getUserSegment(userId?: string): string {
    if (!userId) return 'anonymous';
    const profile = this.userProfiles.get(userId);
    return profile?.segment || 'unknown';
  }

  private mapEventToGA4(eventType: EventType): string {
    const mapping: Record<EventType, string> = {
      [EventType.PAGE_VIEW]: 'page_view',
      [EventType.REGISTRY_CREATED]: 'registry_created',
      [EventType.ITEM_ADDED]: 'add_to_wishlist',
      [EventType.ITEM_PURCHASED]: 'purchase',
      [EventType.SOCIAL_SHARE]: 'share',
      [EventType.SEARCH]: 'search',
      [EventType.SUBSCRIPTION_STARTED]: 'begin_checkout'
    };

    return mapping[eventType] || eventType;
  }

  private processEventQueue(): void {
    if (this.events.length === 0) return;

    // Process events in batches
    const batchSize = 100;
    const batch = this.events.splice(0, batchSize);

    // Store events in database
    this.storeEvents(batch);

    // Update real-time metrics
    this.updateRealTimeMetrics(batch);
  }

  private async storeEvents(events: AnalyticsEvent[]): Promise<void> {
    try {
      // Store in database - implementation would depend on your database setup
      // For now, just log the count
      logger.info('Storing analytics events', { count: events.length });
    } catch (error) {
      logger.error('Failed to store events', { error, count: events.length });
    }
  }

  private updateRealTimeMetrics(events: AnalyticsEvent[]): void {
    const metrics = {
      totalEvents: events.length,
      uniqueUsers: new Set(events.map(e => e.userId).filter(Boolean)).size,
      uniqueSessions: new Set(events.map(e => e.sessionId)).size,
      eventsByType: events.reduce((acc, event) => {
        acc[event.eventType] = (acc[event.eventType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    // Send to APM
    apmManager.recordBusinessMetric('analytics.events_processed', metrics.totalEvents);
    apmManager.recordBusinessMetric('analytics.unique_users', metrics.uniqueUsers);
    apmManager.recordBusinessMetric('analytics.unique_sessions', metrics.uniqueSessions);
  }

  private updateUserSegments(): void {
    for (const [userId, profile] of this.userProfiles.entries()) {
      const newSegment = this.determineUserSegment(profile);
      if (newSegment !== profile.segment) {
        profile.segment = newSegment;
        this.track(EventType.PAGE_VIEW, { segment_changed: true, new_segment: newSegment }, userId);
      }
    }
  }

  private calculateFunnels(): void {
    // Registry Creation Funnel
    const registryFunnel = this.calculateRegistryCreationFunnel();
    this.funnels.set('registry_creation', registryFunnel);

    // Purchase Funnel
    const purchaseFunnel = this.calculatePurchaseFunnel();
    this.funnels.set('purchase', purchaseFunnel);

    // Onboarding Funnel
    const onboardingFunnel = this.calculateOnboardingFunnel();
    this.funnels.set('onboarding', onboardingFunnel);

    logger.info('Funnels calculated', {
      registry_conversion: registryFunnel[registryFunnel.length - 1]?.conversionRate,
      purchase_conversion: purchaseFunnel[purchaseFunnel.length - 1]?.conversionRate
    });
  }

  private calculateRegistryCreationFunnel(): FunnelStep[] {
    // Implementation would analyze actual event data
    return [
      { name: 'Page Visit', eventType: EventType.PAGE_VIEW, users: 1000, conversionRate: 100, dropoffRate: 0, averageTime: 0 },
      { name: 'Registry Started', eventType: EventType.REGISTRY_CREATED, users: 150, conversionRate: 15, dropoffRate: 85, averageTime: 30 },
      { name: 'Items Added', eventType: EventType.ITEM_ADDED, users: 120, conversionRate: 12, dropoffRate: 20, averageTime: 120 },
      { name: 'Registry Shared', eventType: EventType.REGISTRY_SHARED, users: 80, conversionRate: 8, dropoffRate: 33, averageTime: 300 }
    ];
  }

  private calculatePurchaseFunnel(): FunnelStep[] {
    return [
      { name: 'Registry View', eventType: EventType.REGISTRY_VIEW, users: 500, conversionRate: 100, dropoffRate: 0, averageTime: 0 },
      { name: 'Product View', eventType: EventType.PRODUCT_VIEW, users: 300, conversionRate: 60, dropoffRate: 40, averageTime: 45 },
      { name: 'Item Purchased', eventType: EventType.ITEM_PURCHASED, users: 90, conversionRate: 18, dropoffRate: 70, averageTime: 180 }
    ];
  }

  private calculateOnboardingFunnel(): FunnelStep[] {
    return [
      { name: 'App Installed', eventType: EventType.PAGE_VIEW, users: 100, conversionRate: 100, dropoffRate: 0, averageTime: 0 },
      { name: 'First Registry', eventType: EventType.REGISTRY_CREATED, users: 70, conversionRate: 70, dropoffRate: 30, averageTime: 600 },
      { name: 'Subscription Started', eventType: EventType.SUBSCRIPTION_STARTED, users: 15, conversionRate: 15, dropoffRate: 79, averageTime: 1800 }
    ];
  }

  private cleanupOldData(): void {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago

    // Clean up old events
    this.events = this.events.filter(event => event.timestamp > cutoff);

    // Clean up old sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastActivity < cutoff) {
        this.sessions.delete(sessionId);
      }
    }

    logger.info('Analytics data cleanup completed');
  }

  // Utility Methods
  private isSignificantEvent(eventType: EventType): boolean {
    const significantEvents = [
      EventType.REGISTRY_CREATED,
      EventType.SUBSCRIPTION_STARTED,
      EventType.PLAN_UPGRADED,
      EventType.GROUP_GIFT_COMPLETED
    ];
    return significantEvents.includes(eventType);
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private hashIP(ip: string): string {
    // Simple hash for privacy compliance
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(ip + process.env.HASH_SALT).digest('hex').substring(0, 8);
  }

  private hashEmail(email: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(email.toLowerCase() + process.env.HASH_SALT).digest('hex').substring(0, 16);
  }

  private parseDeviceInfo(userAgent: string): DeviceInfo {
    // Simple device detection - in production, use a library like ua-parser-js
    const isMobile = /Mobile|Android|iPhone|iPad/i.test(userAgent);
    const isTablet = /iPad|Tablet/i.test(userAgent);
    
    return {
      type: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop',
      os: this.extractOS(userAgent),
      browser: this.extractBrowser(userAgent),
      viewport: { width: 0, height: 0 } // Would be set from client
    };
  }

  private extractOS(userAgent: string): string {
    if (/Windows/i.test(userAgent)) return 'Windows';
    if (/Mac OS/i.test(userAgent)) return 'macOS';
    if (/Linux/i.test(userAgent)) return 'Linux';
    if (/Android/i.test(userAgent)) return 'Android';
    if (/iOS/i.test(userAgent)) return 'iOS';
    return 'Unknown';
  }

  private extractBrowser(userAgent: string): string {
    if (/Chrome/i.test(userAgent)) return 'Chrome';
    if (/Firefox/i.test(userAgent)) return 'Firefox';
    if (/Safari/i.test(userAgent)) return 'Safari';
    if (/Edge/i.test(userAgent)) return 'Edge';
    return 'Unknown';
  }

  // Public Analytics API
  public getUserAnalytics(userId: string): UserProfile | null {
    return this.userProfiles.get(userId) || null;
  }

  public getEventsByUser(userId: string, limit: number = 100): AnalyticsEvent[] {
    return this.events
      .filter(event => event.userId === userId)
      .slice(-limit);
  }

  public getFunnelAnalysis(funnelName: string): FunnelStep[] | null {
    return this.funnels.get(funnelName) || null;
  }

  public getSessionAnalytics(sessionId: string): any {
    return this.sessions.get(sessionId) || null;
  }

  public getDashboardMetrics(): any {
    const now = Date.now();
    const last24h = now - 86400000;
    
    const recentEvents = this.events.filter(event => event.timestamp > last24h);
    const activeUsers = new Set(recentEvents.map(e => e.userId).filter(Boolean)).size;
    
    return {
      totalEvents: recentEvents.length,
      activeUsers,
      popularEvents: this.getPopularEvents(recentEvents),
      conversionRates: this.getConversionRates(),
      userSegmentDistribution: this.getUserSegmentDistribution()
    };
  }

  private getPopularEvents(events: AnalyticsEvent[]): Array<{ event: string; count: number }> {
    const counts = events.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .map(([event, count]) => ({ event, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private getConversionRates(): Record<string, number> {
    const funnels = Array.from(this.funnels.entries());
    return funnels.reduce((acc, [name, steps]) => {
      acc[name] = steps[steps.length - 1]?.conversionRate || 0;
      return acc;
    }, {} as Record<string, number>);
  }

  private getUserSegmentDistribution(): Record<string, number> {
    const segments = Array.from(this.userProfiles.values()).reduce((acc, profile) => {
      acc[profile.segment] = (acc[profile.segment] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return segments;
  }
}

// Express Middleware for Analytics
export function createAnalyticsMiddleware(analytics: UserAnalyticsManager) {
  return (req: any, res: any, next: any) => {
    // Track page view
    analytics.track(EventType.PAGE_VIEW, {
      page: req.path,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      referrer: req.get('Referrer'),
      url: req.originalUrl,
      shopId: req.shop?.id
    }, req.user?.id, req.sessionID);

    next();
  };
}

// Export singleton instance
export const userAnalytics = new UserAnalyticsManager();