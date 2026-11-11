#!/usr/bin/env node
/**
 * Dev-only web preview with cross-origin isolation.
 *
 * expo-sqlite's web build needs SharedArrayBuffer, which browsers only expose on pages served with
 * `Cross-Origin-Opener-Policy` + `Cross-Origin-Embedder-Policy`. Metro's `enhanceMiddleware`
 * (metro.config.js) adds them to bundles, but Expo CLI serves the HTML page itself, before Metro's
 * middleware, so the page never gets them. This script starts Expo on an internal port and serves
 * the public port through a tiny proxy that adds both headers to every response, including the
 * WebSocket upgrade used by Fast Refresh.
 *
 *   npm run web            → http://localhost:8081  (Expo itself listens on 8082)
 *   WEB_PORT=9000 npm run web
 *   npm run web -- --clear  (extra args are passed to `expo start`)
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';

const PUBLIC_PORT = Number(process.env.WEB_PORT ?? 8081);
const EXPO_PORT = Number(process.env.EXPO_PORT ?? 8082);
const ISOLATION_HEADERS = {
  'cross-origin-embedder-policy': 'credentialless',
  'cross-origin-opener-policy': 'same-origin',
};

const expo = spawn('npx', ['expo', 'start', '--port', String(EXPO_PORT), ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, BROWSER: 'none' },
});

const proxy = http.createServer((req, res) => {
  const upstream = http.request(
    { host: '127.0.0.1', port: EXPO_PORT, method: req.method, path: req.url, headers: req.headers },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.statusMessage, {
        ...upstreamRes.headers,
        ...ISOLATION_HEADERS,
      });
      upstreamRes.pipe(res);
    },
  );
  upstream.on('error', (error) => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
    res.end(`Expo dev server is not reachable on port ${EXPO_PORT} yet (${error.message}). Retry in a moment.`);
  });
  req.pipe(upstream);
});

// Fast Refresh / dev tools WebSockets: replay the upgrade request and pipe raw sockets both ways.
proxy.on('upgrade', (req, socket, head) => {
  const upstream = net.connect(EXPO_PORT, '127.0.0.1', () => {
    const headerLines = Object.entries(req.headers).map(
      ([name, value]) => `${name}: ${Array.isArray(value) ? value.join(', ') : value}`,
    );
    upstream.write([`${req.method} ${req.url} HTTP/${req.httpVersion}`, ...headerLines, '', ''].join('\r\n'));
    if (head?.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
});

proxy.listen(PUBLIC_PORT, () => {
  console.log(`\n[web-proxy] Web preview with cross-origin isolation: http://localhost:${PUBLIC_PORT}`);
  console.log(`[web-proxy] Expo dev server (native devices / Expo Go): port ${EXPO_PORT}\n`);
});

const shutdown = () => {
  proxy.close();
  expo.kill();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
expo.on('exit', (code) => {
  proxy.close();
  process.exit(code ?? 0);
});
