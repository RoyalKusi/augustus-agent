// Minimal health check server — used to diagnose Hostinger startup issues
import http from 'http';

const port = Number(process.env.PORT) || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    port,
    env: process.env.NODE_ENV,
    node: process.version,
    time: new Date().toISOString(),
  }));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Health check server running on port ${port}`);
});
