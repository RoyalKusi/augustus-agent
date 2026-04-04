// Minimal health check server — used to diagnose Hostinger startup issues
import http from 'http';

const port = Number(process.env.PORT) || 3000;

// Test loading critical modules
const diagnostics: Record<string, string> = {};

try {
  await import('./db/client.js');
  diagnostics.db = 'ok';
} catch (e) {
  diagnostics.db = String(e);
}

try {
  await import('./redis/client.js');
  diagnostics.redis = 'ok';
} catch (e) {
  diagnostics.redis = String(e);
}

try {
  await import('./config.js');
  diagnostics.config = 'ok';
} catch (e) {
  diagnostics.config = String(e);
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    port,
    env: process.env.NODE_ENV,
    node: process.version,
    time: new Date().toISOString(),
    diagnostics,
  }));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Health check server running on port ${port}`);
});
