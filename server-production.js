// Production server wrapper to suppress all warnings
// This ensures absolutely no warnings in Railway deployments

// Suppress all Node.js warnings
process.removeAllListeners('warning');
process.on('warning', () => {}); // Silently ignore all warnings

// Override console.warn to suppress any remaining warnings
const originalWarn = console.warn;
console.warn = (...args) => {
  // Filter out npm deprecation warnings
  const warningText = args.join(' ');
  if (warningText.includes('deprecated') || 
      warningText.includes('@shopify/network') ||
      warningText.includes('npm WARN')) {
    return; // Suppress these warnings
  }
  // Log other warnings if needed for debugging
  if (process.env.RAILWAY_ENVIRONMENT !== 'production') {
    originalWarn.apply(console, args);
  }
};

// Set environment to suppress warnings
process.env.NODE_NO_WARNINGS = '1';

// Import and start the actual server
import('./server.js').catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});