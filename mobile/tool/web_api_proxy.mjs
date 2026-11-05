import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const host = '127.0.0.1';
const port = Number(process.env.BUILDMATE_WEB_PORT ?? 49254);
const apiTarget = new URL(
  process.env.BUILDMATE_API_TARGET ?? 'https://api.buildmate24x7.com',
);
const webRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../build/web',
);
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.wasm', 'application/wasm'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

async function proxyApi(request, response, requestUrl) {
  const upstreamUrl = new URL(
    `${requestUrl.pathname}${requestUrl.search}`,
    apiTarget,
  );
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (
      value &&
      !['connection', 'content-length', 'host', 'origin', 'referer'].includes(
        name.toLowerCase(),
      )
    ) {
      headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }
  }

  try {
    const body = ['GET', 'HEAD'].includes(request.method ?? 'GET')
      ? undefined
      : await readRequestBody(request);
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body,
    });
    response.statusCode = upstream.status;
    for (const [name, value] of upstream.headers) {
      if (
        !['connection', 'content-encoding', 'content-length', 'transfer-encoding'].includes(
          name.toLowerCase(),
        )
      ) {
        response.setHeader(name, value);
      }
    }
    response.end(
      request.method === 'HEAD' ? undefined : Buffer.from(await upstream.arrayBuffer()),
    );
  } catch (error) {
    console.error(`API proxy request failed: ${error.message}`);
    response.writeHead(502, { 'Content-Type': 'application/problem+json' });
    response.end(
      JSON.stringify({
        status: 502,
        title: 'Could not reach the BuildMate API from the local web proxy.',
      }),
    );
  }
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length === 0 ? undefined : Buffer.concat(chunks);
}

async function serveWeb(request, response, requestUrl) {
  let relativePath;
  try {
    relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '');
  } catch {
    response.writeHead(400).end('Invalid URL path');
    return;
  }

  let filePath = path.resolve(webRoot, relativePath || 'index.html');
  if (filePath !== webRoot && !filePath.startsWith(`${webRoot}${path.sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  try {
    if (!(await stat(filePath)).isFile()) throw new Error('Not a file');
  } catch {
    // Flutter web uses client-side routing; unknown document paths load index.
    filePath = path.join(webRoot, 'index.html');
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': mimeTypes.get(path.extname(filePath)) ?? 'application/octet-stream',
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Flutter web build not found. Run flutter build web first.');
  }
}

createServer((request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://${host}:${port}`);
  if (requestUrl.pathname === '/api' || requestUrl.pathname.startsWith('/api/')) {
    void proxyApi(request, response, requestUrl);
  } else if (
    requestUrl.pathname === '/files' ||
    requestUrl.pathname.startsWith('/files/')
  ) {
    void proxyApi(request, response, requestUrl);
  } else {
    void serveWeb(request, response, requestUrl);
  }
}).listen(port, host, () => {
  console.log(`BuildMate Flutter Web: http://${host}:${port}`);
  console.log(`API proxy target: ${apiTarget.origin}`);
});
