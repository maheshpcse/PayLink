import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.mjs';

test('serves the app and its browser module, and returns 404 for missing files', async (t) => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const page = await fetch(`${baseUrl}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /NoteDeck/);

  const app = await fetch(`${baseUrl}/app.js`);
  assert.equal(app.status, 200);
  assert.match(app.headers.get('content-type'), /text\/javascript/);

  const parser = await fetch(`${baseUrl}/src/parser.mjs`);
  assert.equal(parser.status, 200);
  assert.match(await parser.text(), /parseNotes/);

  const quiz = await fetch(`${baseUrl}/src/quiz.mjs`);
  assert.equal(quiz.status, 200);
  assert.match(quiz.headers.get('content-type'), /text\/javascript/);

  const missing = await fetch(`${baseUrl}/missing-file.js`);
  assert.equal(missing.status, 404);
});
