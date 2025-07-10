// Security middleware and configuration for WishCraft production
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

// Content Security Policy configuration
export const cspConfig = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'", // Required for Shopify embedded apps
      "https://cdn.shopify.com",
      "https://js.stripe.com",
      "https://www.google-analytics.com",
      "https://www.googletagmanager.com"
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'", // Required for Polaris components
      "https://cdn.shopify.com",
      "https://fonts.googleapis.com"
    ],
    imgSrc: [
      "'self'",
      "data:",
      "blob:",
      "https:",
      "https://cdn.shopify.com",
      "https://*.amazonaws.com"
    ],
    fontSrc: [
      "'self'",
      "https://cdn.shopify.com",
      "https://fonts.gstatic.com"
    ],
    connectSrc: [
      "'self'",
      "https://*.shopify.com",
      "https://api.shopify.com",
      "https://www.google-analytics.com",
      "https://js.stripe.com"
    ],
    frameSrc: [
      "'self'",
      "https://js.stripe.com",
      "https://hooks.stripe.com"
    ],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'", "https:", "data:"],
    workerSrc: ["'self'", "blob:"],
    childSrc: ["'self'"],
    formAction: ["'self'"],
    upgradeInsecureRequests: []
  }
};

// Helmet security configuration
export const helmetConfig = {
  contentSecurityPolicy: {
    directives: cspConfig.directives,
    reportOnly: false
  },
  crossOriginEmbedderPolicy: false, // Disabled for Shopify embedded apps
  crossOriginOpenerPolicy: { policy: "unsafe-none" }, // Required for Shopify
  crossOriginResourcePolicy: false, // Disabled for Shopify embedded apps
  dnsPrefetchControl: true,
  frameguard: false, // Disabled for Shopify CSP compatibility
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true
};

// Rate limiting configuration
export const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60 // 15 minutes in seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path.startsWith('/health');
  },
  keyGenerator: (req) => {
    // Use X-Forwarded-For header for load balancer setups
    return req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  }
};

// API-specific rate limiting (stricter)
export const apiRateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 API requests per windowMs
  message: {
    error: 'API rate limit exceeded, please try again later.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false
};

// Webhook rate limiting (very strict)
export const webhookRateLimitConfig = {
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // Limit each IP to 50 webhook requests per windowMs
  message: {
    error: 'Webhook rate limit exceeded.',
    retryAfter: 5 * 60
  },
  standardHeaders: true,
  legacyHeaders: false
};

// Slow down configuration (progressive delay)
export const slowDownConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 500, // Allow 500 requests per 15 minutes without delay
  delayMs: 500, // Add 500ms delay per request after delayAfter
  maxDelayMs: 20000, // Maximum delay of 20 seconds
  skip: (req) => {
    return req.path.startsWith('/health');
  }
};

// CORS configuration for Shopify apps
export const corsConfig = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://admin.shopify.com',
      /https:\/\/.*\.myshopify\.com$/,
      process.env.HOST,
      ...(process.env.CORS_ADDITIONAL_ORIGINS?.split(',') || [])
    ].filter(Boolean);
    
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return origin === allowedOrigin;
      }
      return allowedOrigin.test(origin);
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Shopify-Topic',
    'X-Shopify-Hmac-Sha256',
    'X-Shopify-Shop-Domain',
    'X-Shopify-API-Version'
  ],
  optionsSuccessStatus: 200
};

// Trusted proxy configuration
export const trustedProxyConfig = {
  // Trust first proxy (load balancer)
  trust: 1,
  // Alternative: trust specific IPs
  // trust: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']
};

// Session security configuration
export const sessionSecurityConfig = {
  name: 'wishcraft.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevent XSS
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'none' // Required for Shopify embedded apps
  },
  store: undefined // Will be set to Redis store in production
};

// Input validation and sanitization
export const validationConfig = {
  // Maximum request body size
  bodyLimit: '10mb',
  
  // Parameter pollution prevention
  parameterLimit: 100,
  
  // URL-encoded body parsing
  urlEncoded: {
    extended: false,
    limit: '10mb',
    parameterLimit: 100
  },
  
  // JSON body parsing
  json: {
    limit: '10mb',
    strict: true
  }
};

// Request timeout configuration
export const timeoutConfig = {
  // General request timeout
  timeout: 30000, // 30 seconds
  
  // Webhook timeout
  webhookTimeout: 10000, // 10 seconds
  
  // API timeout
  apiTimeout: 15000 // 15 seconds
};

// Security headers middleware factory
export function createSecurityMiddleware() {
  return [
    // Helmet for security headers
    helmet(helmetConfig),
    
    // Rate limiting
    rateLimit(rateLimitConfig),
    
    // Progressive slowdown
    slowDown(slowDownConfig)
  ];
}

// API security middleware factory
export function createApiSecurityMiddleware() {
  return [
    // Stricter rate limiting for API endpoints
    rateLimit(apiRateLimitConfig),
    
    // Additional API-specific security headers
    (req, res, next) => {
      res.setHeader('X-API-Version', '1.0.0');
      res.setHeader('X-RateLimit-Policy', 'standard');
      next();
    }
  ];
}

// Webhook security middleware factory
export function createWebhookSecurityMiddleware() {
  return [
    // Very strict rate limiting for webhooks
    rateLimit(webhookRateLimitConfig),
    
    // Webhook-specific headers
    (req, res, next) => {
      res.setHeader('X-Webhook-Received', new Date().toISOString());
      next();
    }
  ];
}

// HTTPS redirect middleware
export function httpsRedirect(req, res, next) {
  if (process.env.NODE_ENV === 'production' && !req.secure && req.get('X-Forwarded-Proto') !== 'https') {
    return res.redirect(301, `https://${req.get('Host')}${req.url}`);
  }
  next();
}

// Security audit logger
export function securityAuditLogger(req, res, next) {
  const securityEvents = [];
  
  // Log suspicious patterns
  if (req.path.includes('..') || req.path.includes('<script>')) {
    securityEvents.push('suspicious_path');
  }
  
  if (req.get('User-Agent')?.includes('bot') && !req.path.startsWith('/health')) {
    securityEvents.push('bot_access');
  }
  
  // Log rate limit hits
  if (res.get('X-RateLimit-Remaining') === '0') {
    securityEvents.push('rate_limit_exceeded');
  }
  
  if (securityEvents.length > 0) {
    console.warn('[SECURITY]', {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      events: securityEvents
    });
  }
  
  next();
}

export default {
  cspConfig,
  helmetConfig,
  rateLimitConfig,
  corsConfig,
  sessionSecurityConfig,
  createSecurityMiddleware,
  createApiSecurityMiddleware,
  createWebhookSecurityMiddleware,
  httpsRedirect,
  securityAuditLogger
};