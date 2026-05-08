/**
 * Vite plugin that serves a tiny REST API for mock-data.json persistence.
 * GET  /__mock-db  → returns current JSON
 * POST /__mock-db  → saves body to JSON file
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

export function mockDbPlugin(): Plugin {
  const dbPath = path.resolve('mock-data.json');

  return {
    name: 'mock-db',
    configureServer(server) {
      server.middlewares.use('/__mock-db', (req, res) => {
        if (req.method === 'GET') {
          let data = '{}';
          if (fs.existsSync(dbPath)) {
            data = fs.readFileSync(dbPath, 'utf-8');
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(data);
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: Buffer) => {
            body += chunk.toString();
          });
          req.on('end', () => {
            fs.writeFileSync(dbPath, body, 'utf-8');
            res.end('ok');
          });
          return;
        }

        res.statusCode = 405;
        res.end('Method not allowed');
      });
    },
  };
}
