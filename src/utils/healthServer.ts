import http from 'http';

let server: http.Server | null = null;

export function startHealthServer(): void {
  const port = process.env.HEALTH_PORT || process.env.HEALTHCHECK_PORT || '3001';

  server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('EonBypass bot is running');
  });

  server.listen(Number(port), '0.0.0.0', () => {
    console.log(`[Health] HTTP server listening on port ${port}`);
  });
}

export function stopHealthServer(): Promise<void> {
  if (!server) return Promise.resolve();

  return new Promise((resolve, reject) => {
    server!.close((err) => (err ? reject(err) : resolve()));
    server = null;
  });
}
