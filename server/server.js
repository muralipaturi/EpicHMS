const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');
const { initSchema, queryOne, getDb } = require('./db');
const { seedDatabase } = require('./seed');
const { registerRoutes } = require('./routes');

const PORT = process.env.PORT || 3000;
const CLIENT_DIR = path.join(__dirname, '..', 'client');

// Simple router structure
const routes = {
  GET: [],
  POST: [],
  PUT: [],
  DELETE: []
};

const router = {
  get(pattern, handler) { routes.GET.push({ pattern, handler, regex: compileRoute(pattern) }); },
  post(pattern, handler) { routes.POST.push({ pattern, handler, regex: compileRoute(pattern) }); },
  put(pattern, handler) { routes.PUT.push({ pattern, handler, regex: compileRoute(pattern) }); },
  delete(pattern, handler) { routes.DELETE.push({ pattern, handler, regex: compileRoute(pattern) }); }
};

function compileRoute(pattern) {
  const paramNames = [];
  const regexStr = '^' + pattern.replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
    paramNames.push(name);
    return '([^/]+)';
  }) + '$';
  return { regex: new RegExp(regexStr), paramNames };
}

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

// Initialize DB and Seed if first time
initSchema();
const userCount = queryOne('SELECT COUNT(*) as c FROM users').c;
if (userCount === 0) {
  console.log('[EpicHMS Server] Fresh installation detected. Seeding baseline data...');
  seedDatabase();
}

// Register API endpoints
registerRoutes(router);

// Create HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Response helper methods
  res.json = (data) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.writeHead(res.statusCode || 200);
    res.end(JSON.stringify(data));
  };

  res.status = (code) => {
    res.statusCode = code;
    return res;
  };

  // Check API routes
  if (pathname.startsWith('/api/')) {
    const methodRoutes = routes[method] || [];
    let matched = null;
    let params = {};

    for (const r of methodRoutes) {
      const match = pathname.match(r.regex.regex);
      if (match) {
        matched = r.handler;
        r.regex.paramNames.forEach((name, idx) => {
          params[name] = decodeURIComponent(match[idx + 1]);
        });
        break;
      }
    }

    if (matched) {
      req.params = params;
      req.query = parsedUrl.query;

      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        let bodyStr = '';
        req.on('data', chunk => { bodyStr += chunk; });
        req.on('end', () => {
          try {
            req.body = bodyStr ? JSON.parse(bodyStr) : {};
          } catch (e) {
            req.body = {};
          }
          try {
            matched(req, res);
          } catch (err) {
            console.error('[EpicHMS API Error]', err);
            res.status(500).json({ error: 'Internal Server Error', details: err.message });
          }
        });
      } else {
        try {
          matched(req, res);
        } catch (err) {
          console.error('[EpicHMS API Error]', err);
          res.status(500).json({ error: 'Internal Server Error', details: err.message });
        }
      }
      return;
    } else {
      res.status(404).json({ error: 'API route not found: ' + pathname });
      return;
    }
  }

  // Static File Serving from client/
  let filePath = path.join(CLIENT_DIR, pathname === '/' ? 'index.html' : pathname);

  // If path doesn't have an extension, try index.html for SPA routing
  if (!path.extname(filePath)) {
    filePath = path.join(CLIENT_DIR, 'index.html');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for client-side routing
      const fallbackIndex = path.join(CLIENT_DIR, 'index.html');
      fs.readFile(fallbackIndex, (fErr, content) => {
        if (fErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('EpicHMS: 404 Not Found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error reading file');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log('================================================================');
  console.log(`  🏥 EpicHMS - Hospital Management Platform Replica`);
  console.log(`  🌐 Web Application: http://localhost:${PORT}`);
  console.log(`  🔌 REST API Base:   http://localhost:${PORT}/api/health`);
  console.log(`  ⚡ Fast Test Reset: POST http://localhost:${PORT}/api/test/reset-db`);
  console.log(`  🧪 Test Suite:      node tests/test-runner.js`);
  console.log('================================================================');
});
