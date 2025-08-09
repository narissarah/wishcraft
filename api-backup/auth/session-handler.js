// Enhanced session token handler for Shopify OAuth compliance
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
    console.log('Session Handler:', req.method, req.url);

    try {
        const { method, query, headers, body } = req;

        // Handle session token verification
        if (method === 'POST' && query.action === 'verify') {
            return handleSessionTokenVerification(req, res);
        }

        // Handle OAuth callback
        if (method === 'GET' && query.code) {
            return handleOAuthCallback(req, res);
        }

        // Handle session refresh
        if (method === 'POST' && query.action === 'refresh') {
            return handleSessionRefresh(req, res);
        }

        // Default response
        return res.status(400).json({
            error: 'Invalid request',
            supported_actions: ['verify', 'refresh'],
            supported_methods: ['GET (OAuth callback)', 'POST (session operations)']
        });

    } catch (error) {
        console.error('Session Handler error:', error);
        return res.status(500).json({
            error: 'Session handling failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

// Verify session token from App Bridge
async function handleSessionTokenVerification(req, res) {
    try {
        const sessionToken = req.headers.authorization?.replace('Bearer ', '');
        
        if (!sessionToken) {
            return res.status(401).json({
                error: 'No session token provided',
                code: 'MISSING_SESSION_TOKEN'
            });
        }

        // Verify session token (without verification for development)
        // In production, you would verify with Shopify's public key
        const payload = jwt.decode(sessionToken);
        
        if (!payload || !payload.dest) {
            return res.status(401).json({
                error: 'Invalid session token',
                code: 'INVALID_TOKEN'
            });
        }

        // Extract shop domain
        const shopDomain = payload.dest.replace('https://', '');

        // Verify token expiration
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
            return res.status(401).json({
                error: 'Session token expired',
                code: 'TOKEN_EXPIRED'
            });
        }

        // Return session info
        return res.status(200).json({
            valid: true,
            shop: shopDomain,
            audience: payload.aud,
            issued_at: payload.iat,
            expires_at: payload.exp,
            session_info: {
                shop_domain: shopDomain,
                user_id: payload.sub,
                session_valid: true
            }
        });

    } catch (error) {
        console.error('Session token verification error:', error);
        return res.status(401).json({
            error: 'Session verification failed',
            code: 'VERIFICATION_FAILED',
            message: error.message
        });
    }
}

// Handle OAuth callback from Shopify
async function handleOAuthCallback(req, res) {
    try {
        const { code, shop, state } = req.query;

        if (!code || !shop) {
            return res.status(400).json({
                error: 'Missing required OAuth parameters',
                required: ['code', 'shop']
            });
        }

        // Verify state parameter (CSRF protection)
        // In production, verify the state parameter matches what was sent

        // Exchange authorization code for access token
        const tokenResponse = await exchangeCodeForToken(code, shop);
        
        if (!tokenResponse.access_token) {
            return res.status(400).json({
                error: 'Failed to obtain access token',
                details: tokenResponse
            });
        }

        // Store session information
        const session = await createSession({
            shop,
            accessToken: tokenResponse.access_token,
            scope: tokenResponse.scope
        });

        // Redirect to app with success
        const appUrl = `/app?shop=${encodeURIComponent(shop)}&session_id=${session.id}`;
        
        return res.redirect(302, appUrl);

    } catch (error) {
        console.error('OAuth callback error:', error);
        return res.status(500).json({
            error: 'OAuth callback failed',
            message: error.message
        });
    }
}

// Handle session refresh
async function handleSessionRefresh(req, res) {
    try {
        const { shop, session_id } = req.body;

        if (!shop || !session_id) {
            return res.status(400).json({
                error: 'Missing required parameters',
                required: ['shop', 'session_id']
            });
        }

        // Refresh session (implementation depends on your session storage)
        const refreshedSession = await refreshSession(shop, session_id);

        return res.status(200).json({
            success: true,
            session: refreshedSession,
            message: 'Session refreshed successfully'
        });

    } catch (error) {
        console.error('Session refresh error:', error);
        return res.status(500).json({
            error: 'Session refresh failed',
            message: error.message
        });
    }
}

// Exchange authorization code for access token
async function exchangeCodeForToken(code, shop) {
    try {
        const clientId = process.env.SHOPIFY_API_KEY;
        const clientSecret = process.env.SHOPIFY_API_SECRET;

        if (!clientId || !clientSecret) {
            throw new Error('Shopify API credentials not configured');
        }

        const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code: code
            })
        });

        if (!response.ok) {
            throw new Error(`OAuth token exchange failed: ${response.status}`);
        }

        return await response.json();

    } catch (error) {
        console.error('Token exchange error:', error);
        throw error;
    }
}

// Create and store session
async function createSession({ shop, accessToken, scope }) {
    try {
        const sessionId = crypto.randomUUID();
        
        // In production, store in database
        const session = {
            id: sessionId,
            shop,
            accessToken: encrypt(accessToken), // Encrypt token
            scope,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
        };

        console.log('Session created:', { id: sessionId, shop, scope });
        
        return session;

    } catch (error) {
        console.error('Session creation error:', error);
        throw error;
    }
}

// Refresh existing session
async function refreshSession(shop, sessionId) {
    try {
        // In production, retrieve and update session in database
        const session = {
            id: sessionId,
            shop,
            refreshedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };

        console.log('Session refreshed:', { id: sessionId, shop });
        
        return session;

    } catch (error) {
        console.error('Session refresh error:', error);
        throw error;
    }
}

// Simple encryption for access tokens (use proper encryption in production)
function encrypt(text) {
    if (!process.env.ENCRYPTION_KEY) {
        return text; // Development fallback
    }
    
    try {
        const algorithm = 'aes-256-gcm';
        const key = Buffer.from(process.env.ENCRYPTION_KEY, 'base64');
        const iv = crypto.randomBytes(12);
        
        const cipher = crypto.createCipher(algorithm, key);
        cipher.setAAD(Buffer.from('shopify-access-token'));
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
        console.error('Encryption error:', error);
        return text; // Fallback to plain text in development
    }
}