// Minimal test server to verify Railway deployment
import http from 'http';

const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  console.log(`Request received: ${req.method} ${req.url}`);
  
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      message: 'Test server is running',
      port: port,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Test server is running on Railway!');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Test server listening on 0.0.0.0:${port}`);
});