import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from './router.js';
import { DomainError } from '../domain/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_PUBLIC_DIR = path.resolve(__dirname, '../../public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const ERROR_STATUS_MAP = {
  VALIDATION: 400,
  BAD_JSON: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SOLD_OUT: 409,
  INVALID_STATE: 409,
  INVALID_TRANSITION: 409,
};

export function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

export function sendError(res, statusCode, code, message) {
  sendJson(res, statusCode, {
    error: {
      code,
      message,
    },
  });
}

/**
 * Safely parses a JSON request body. Throws DomainError('BAD_JSON') on syntax error.
 */
export async function readJsonBody(req, maxBytes = 1_048_576) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      throw new DomainError('VALIDATION', 'Request body exceeds maximum allowed size.');
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (raw.length === 0) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new DomainError('BAD_JSON', 'Request body must be valid JSON.');
  }
}

/**
 * Serves static files strictly inside `publicDir`, preventing directory traversal.
 */
async function serveStatic(res, pathname, publicDir) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    sendError(res, 400, 'VALIDATION', 'Malformed URL path.');
    return;
  }

  // Strip leading slashes so path.resolve treats it as relative to publicDir
  const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  const resolvedPublicRoot = path.resolve(publicDir);
  const resolvedTarget = path.resolve(resolvedPublicRoot, relativePath);

  // Enforce strict directory containment (prevents "../" path escape)
  const isInsidePublic =
    resolvedTarget === resolvedPublicRoot ||
    resolvedTarget.startsWith(`${resolvedPublicRoot}${path.sep}`);

  if (!isInsidePublic) {
    sendError(res, 403, 'FORBIDDEN', 'Access denied.');
    return;
  }

  try {
    const stat = await fs.stat(resolvedTarget);
    if (stat.isDirectory()) {
      const indexFile = path.join(resolvedTarget, 'index.html');
      const content = await fs.readFile(indexFile);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': content.length,
      });
      res.end(content);
      return;
    }

    const ext = path.extname(resolvedTarget).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = await fs.readFile(resolvedTarget);

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': content.length,
    });
    res.end(content);
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
      sendError(res, 404, 'NOT_FOUND', 'Resource not found.');
      return;
    }
    throw err;
  }
}

/**
 * Creates the HTTP request handler and registers core system routes.
 */
export function createApp({ publicDir = DEFAULT_PUBLIC_DIR, configureRoutes } = {}) {
  const router = new Router();

  // Health check endpoint
  router.get('/health', (_req, res) => {
    sendJson(res, 200, { status: 'ok' });
  });

  // Allow future builds (Build 4+) to register /api routes cleanly
  if (typeof configureRoutes === 'function') {
    configureRoutes(router);
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = url.pathname;
      const method = req.method || 'GET';

      // Parse JSON body eagerly for API requests that carry a payload
      if (
        pathname.startsWith('/api') &&
        ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())
      ) {
        req.body = await readJsonBody(req);
      }

      const matched = router.match(method, pathname);
      if (matched) {
        req.params = matched.params;
        req.query = url.searchParams;
        await matched.handler(req, res);
        return;
      }

      // Unknown /api routes always return structured JSON 404
      if (pathname === '/api' || pathname.startsWith('/api/')) {
        sendError(res, 404, 'NOT_FOUND', `No route matches ${method} ${pathname}`);
        return;
      }

      // Only allow GET/HEAD for static assets
      if (method !== 'GET' && method !== 'HEAD') {
        sendError(res, 405, 'METHOD_NOT_ALLOWED', `Method ${method} not allowed.`);
        return;
      }

      await serveStatic(res, pathname, publicDir);
    } catch (err) {
      if (err instanceof DomainError) {
        const status = ERROR_STATUS_MAP[err.code] || 400;
        sendError(res, status, err.code, err.message);
        return;
      }

      // Never leak stack traces or internal error messages to clients
      sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
    }
  });

  return { server, router };
}