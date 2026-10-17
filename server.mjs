import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { basename, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

export function createServer(publicDirectory = resolve('public')) {
  const root = resolve(publicDirectory);
  const sourceRoot = resolve(root, '..', 'src');

  return createHttpServer((request, response) => {
    const requestPath = decodeURIComponent((request.url || '/').split('?')[0]);
    let filePath;
    if (requestPath.startsWith('/src/')) {
      const sourceName = basename(requestPath);
      filePath = normalize(join(sourceRoot, sourceName));
      if (!['parser.mjs', 'quiz.mjs'].includes(sourceName)) filePath = '';
    } else {
      const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^[/\\]+/, '');
      filePath = normalize(join(root, relativePath));
    }

    const isPublicFile = filePath && filePath.startsWith(root);
    const isSourceFile = filePath && filePath.startsWith(sourceRoot);
    if ((!isPublicFile && !isSourceFile) || !existsSync(filePath) || !statSync(filePath).isFile()) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'cache-control': 'no-cache',
      'content-type': MIME_TYPES[extname(filePath)] || 'application/octet-stream',
    });
    createReadStream(filePath).pipe(response);
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, '127.0.0.1', () => {
    console.log(`Markdown Flashcards is running at http://127.0.0.1:${port}`);
  });
}
