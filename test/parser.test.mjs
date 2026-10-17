import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNotes } from '../src/parser.mjs';

test('parses question and answer pairs under a topic heading', () => {
  const result = parseNotes('# Biology\r\n\r\nQ: What is osmosis?\r\nA: Water moving across a membrane.');

  assert.equal(result.cards.length, 1);
  assert.deepEqual(result.cards[0], {
    id: result.cards[0].id,
    question: 'What is osmosis?',
    answer: 'Water moving across a membrane.',
    topic: 'Biology',
    source: 'Q: What is osmosis?\nA: Water moving across a membrane.',
  });
  assert.deepEqual(result.warnings, []);
});

test('parses definition-style cards and ignores fenced code', () => {
  const result = parseNotes('## Cells\n\n- **Nucleus**: Holds genetic material.\n\n```md\n- **Not a card**: Ignore this.\n```');

  assert.equal(result.cards.length, 1);
  assert.equal(result.cards[0].question, 'Nucleus');
  assert.equal(result.cards[0].answer, 'Holds genetic material.');
  assert.equal(result.cards[0].topic, 'Cells');
});

test('reports incomplete pairs and empty input clearly', () => {
  const incomplete = parseNotes('Q: What is ATP?');
  assert.equal(incomplete.cards.length, 0);
  assert.ok(incomplete.warnings.some((warning) => warning.includes('no answer')));

  const empty = parseNotes('');
  assert.deepEqual(empty.cards, []);
  assert.ok(empty.warnings[0].includes('Add some Markdown'));
});
