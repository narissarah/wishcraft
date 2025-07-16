interface CriticalCSSProps {
  styles: string;
}

// SECURITY FIX: Add basic CSS sanitization to prevent injection
function sanitizeCSS(css: string): string {
  // Remove potentially dangerous CSS content
  return css
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/expression\s*\(/gi, '') // Remove CSS expressions
    .replace(/@import/gi, '') // Remove @import statements
    .replace(/url\s*\(\s*["']?javascript:/gi, 'url("about:blank"'); // Sanitize javascript URLs
}

export function CriticalCSS({ styles }: CriticalCSSProps) {
  if (!styles) return null;
  
  // SECURITY: Sanitize CSS content before injection
  const sanitizedStyles = sanitizeCSS(styles);
  
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: sanitizedStyles,
      }}
    />
  );
}