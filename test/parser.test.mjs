import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNotes } from '../src/parser.mjs';

test('parses multiple valid Q/A cards and trims their content', () => {
  const result = parseNotes([
    'Q:   What is osmosis?   ',
    'A: Water moving across a membrane.  ',
    'Q: Why does it matter?',
    'A: It helps cells maintain balance.',
  ].join('\n'));

  assert.deepEqual(result.cards.map(({ question, answer, topic, source }) => ({
    question,
    answer,
    topic,
    source,
  })), [
    {
      question: 'What is osmosis?',
      answer: 'Water moving across a membrane.',
      topic: 'General',
      source: 'Q: What is osmosis?\nA: Water moving across a membrane.',
    },
    {
      question: 'Why does it matter?',
      answer: 'It helps cells maintain balance.',
      topic: 'General',
      source: 'Q: Why does it matter?\nA: It helps cells maintain balance.',
    },
  ]);
  assert.equal(new Set(result.cards.map(({ id }) => id)).size, 2);
  assert.deepEqual(result.warnings, []);
});

test('parses supported definition-card list styles', () => {
  const result = parseNotes([
    '# Cells',
    '- **Nucleus**: Holds genetic material.',
    '* **Ribosome**: Builds proteins.',
    '+ **Membrane**: Controls what enters the cell.',
    '1. **Cytoplasm**: Jelly-like interior.',
    '2) **Organelle**: A specialized cell structure.',
    '**DNA**: Stores genetic instructions.',
  ].join('\n'));

  assert.deepEqual(result.cards.map(({ question, answer, topic }) => ({ question, answer, topic })), [
    { question: 'Nucleus', answer: 'Holds genetic material.', topic: 'Cells' },
    { question: 'Ribosome', answer: 'Builds proteins.', topic: 'Cells' },
    { question: 'Membrane', answer: 'Controls what enters the cell.', topic: 'Cells' },
    { question: 'Cytoplasm', answer: 'Jelly-like interior.', topic: 'Cells' },
    { question: 'Organelle', answer: 'A specialized cell structure.', topic: 'Cells' },
    { question: 'DNA', answer: 'Stores genetic instructions.', topic: 'Cells' },
  ]);
  assert.deepEqual(result.warnings, []);
});

test('tracks headings across mixed Markdown line endings', () => {
  const result = parseNotes([
    '## Biology\r\n',
    'Q: What is a cell?\r',
    'A: The basic unit of life.\n',
    '### Membranes ###\r',
    'Q: What surrounds a cell?\r\n',
    'A: A selectively permeable membrane.\n',
  ].join(''));

  assert.deepEqual(result.cards.map(({ question, answer, topic }) => ({ question, answer, topic })), [
    { question: 'What is a cell?', answer: 'The basic unit of life.', topic: 'Biology' },
    {
      question: 'What surrounds a cell?',
      answer: 'A selectively permeable membrane.',
      topic: 'Membranes',
    },
  ]);
  assert.deepEqual(result.warnings, []);
});

test('ignores Q/A and definition-looking lines inside fenced code', () => {
  const result = parseNotes([
    '# Notes',
    'Q: Which card is visible?',
    'A: The one outside the fence.',
    '```markdown',
    'Q: Which card is hidden?',
    'A: This must not be parsed.',
    '- **Hidden definition**: This must not be parsed either.',
    '```',
    '- **Visible definition**: This is parsed.',
  ].join('\n'));

  assert.deepEqual(result.cards.map(({ question, answer, topic }) => ({ question, answer, topic })), [
    { question: 'Which card is visible?', answer: 'The one outside the fence.', topic: 'Notes' },
    { question: 'Visible definition', answer: 'This is parsed.', topic: 'Notes' },
  ]);
  assert.deepEqual(result.warnings, []);
});

test('warns for answers without questions and questions without answers', () => {
  const result = parseNotes('A: An orphan answer.\nQ: What remains unanswered?');

  assert.deepEqual(result.cards, []);
  assert.deepEqual(result.warnings, [
    'Answer on line 1 has no question.',
    'Question on line 2 has no answer.',
    'No flashcards found. Use Q:/A: pairs or **Term**: definition lines.',
  ]);
});

test('returns the empty-input warning for omitted and whitespace-only notes', () => {
  const omitted = parseNotes();
  assert.deepEqual(omitted.cards, []);
  assert.deepEqual(omitted.warnings, ['Add some Markdown notes to generate flashcards.']);

  const whitespaceOnly = parseNotes(' \r\n\t ');
  assert.deepEqual(whitespaceOnly.cards, []);
  assert.deepEqual(whitespaceOnly.warnings, ['Add some Markdown notes to generate flashcards.']);
});

test('accepts case-insensitive markers and warns when prose has no cards', () => {
  const result = parseNotes('q: What is ATP?\na: Cellular energy currency.');
  assert.equal(result.cards[0].answer, 'Cellular energy currency.');
  assert.deepEqual(result.warnings, []);

  const prose = parseNotes('These notes do not use a supported card format.');
  assert.deepEqual(prose.warnings, [
    'No flashcards found. Use Q:/A: pairs or **Term**: definition lines.',
  ]);
});
