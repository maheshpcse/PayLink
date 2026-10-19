import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import express, { type Express } from 'express';
import { createApplication, type PayLinkApplication } from './server.js';
import { loadConfig } from './config.js';

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
