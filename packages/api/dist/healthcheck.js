// Ultra-minimal healthcheck — no imports, just raw http
import http from 'http';
const port = Number(process.env.PORT) || 3000;
const server = http.createServer((req, res) => {
    const info = {
        status: 'ok',
        port,
        env: process.env.NODE_ENV,
        node: process.version,
        time: new Date().toISOString(),
        envVars: {
            DB_HOST: (process.env.DB_HOST || process.env.PGHOST) ? 'set' : 'missing',
            DB_PASSWORD: (process.env.DB_PASSWORD || process.env.PGPASSWORD) ? 'set' : 'missing',
            REDIS_URL: process.env.REDIS_URL ? 'set' : 'missing',
            ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ? `${process.env.ENCRYPTION_KEY.length} chars` : 'missing',
            JWT_SECRET: process.env.JWT_SECRET ? 'set' : 'missing',
        },
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(info, null, 2));
});
server.listen(port, '0.0.0.0', () => {
    console.log(`Healthcheck listening on port ${port}`);
});
//# sourceMappingURL=healthcheck.js.map