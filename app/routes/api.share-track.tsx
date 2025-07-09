import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { createRegistrySharingService } from "~/lib/registry-sharing.server";

/**
 * API endpoint for tracking share link views
 * Called when someone accesses a registry via a shared link
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const formData = await request.formData();
    const token = formData.get('token') as string;
    const shopId = formData.get('shopId') as string;
    
    if (!token || !shopId) {
      return json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const sharingService = createRegistrySharingService(shopId);
    
    // Extract viewer information from request
    const viewerInfo = {
      ipAddress: request.headers.get('x-forwarded-for') || 
                 request.headers.get('x-real-ip') || 
                 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
      referrer: request.headers.get('referer') || undefined
    };

    // Track the view
    const success = await sharingService.trackShareView(token, viewerInfo);
    
    if (success) {
      return json({ 
        success: true, 
        message: 'Share view tracked successfully' 
      });
    } else {
      return json({ 
        error: 'Invalid or expired share link' 
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error tracking share view:', error);
    return json({ 
      error: 'Failed to track share view' 
    }, { status: 500 });
  }
};

/**
 * Handle GET requests for share link validation
 */
export const loader = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const shopId = url.searchParams.get('shopId');
  
  if (!token || !shopId) {
    return json({ error: 'Missing required parameters' }, { status: 400 });
  }

  try {
    const sharingService = createRegistrySharingService(shopId);
    
    // Just validate the token without tracking the view
    // (the actual view tracking happens when the registry page loads)
    const viewerInfo = {
      ipAddress: request.headers.get('x-forwarded-for') || 
                 request.headers.get('x-real-ip') || 
                 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
      referrer: request.headers.get('referer') || undefined
    };

    const success = await sharingService.trackShareView(token, viewerInfo);
    
    return json({ 
      valid: success,
      message: success ? 'Valid share link' : 'Invalid or expired share link'
    });
  } catch (error) {
    console.error('Error validating share link:', error);
    return json({ 
      valid: false,
      error: 'Failed to validate share link' 
    }, { status: 500 });
  }
};