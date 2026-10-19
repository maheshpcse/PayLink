import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import express, { type Express } from 'express';
import { createApplication, type PayLinkApplication } from './server.js';
import { loadConfig } from './config.js';

function loadDotEnv(path = resolve('.env')): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

/**
 * Adapt Express' native request/response objects to the existing application
 * pipeline. The application remains responsible for parsing, validation,
 * headers, CORS, authentication, and every route response.
 */
export function createExpressApp(application: PayLinkApplication): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use((request, response) => {
    void application.handle(request, response);
  });
  return app;
}

async function main(): Promise<void> {
  loadDotEnv();
  const config = loadConfig();
  const application = await createApplication(config);
  const app = createExpressApp(application);
  app.listen(config.port, () => {
    console.log(
      JSON.stringify({
        level: 'info',
        message: 'PayLink API listening',
        port: config.port,
        framework: 'express',
        persistence: 'in-memory-demo-repository',
        paymentProvider: config.paymentProviderName,
      }),
    );
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  void main();
}
