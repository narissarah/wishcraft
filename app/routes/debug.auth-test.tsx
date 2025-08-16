import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  
  // Test different paths
  const testPaths = [
    '/auth/login',
    '/auth/callback',
    '/auth/logout',
    '/app',
    '/app/settings',
    '/api/test',
    '/webhooks/test'
  ];
  
  const results = testPaths.map(path => {
    const isAuth = path.startsWith('/auth');
    const isApp = path.startsWith('/app');
    const isApi = path.startsWith('/api');
    const isWebhook = path.startsWith('/webhooks');
    
    return {
      path,
      isAuth,
      isApp,
      isApi,
      isWebhook,
      shouldUseLogin: isAuth,
      shouldUseAdmin: isApp && !isAuth,
      shouldSkipAuth: isApi || isWebhook
    };
  });
  
  return json({
    currentPath: url.pathname,
    analysis: results,
    headers: Object.fromEntries(request.headers.entries()),
    cookies: request.headers.get('cookie') || 'none'
  });
}