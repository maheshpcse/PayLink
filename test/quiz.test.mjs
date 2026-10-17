import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuiz, scoreQuiz } from '../src/quiz.mjs';

const cards = [
  { id: 'one', question: 'Capital of France?', answer: 'Paris' },
  { id: 'two', question: 'Capital of Italy?', answer: 'Rome' },
  { id: 'three', question: 'Capital of Spain?', answer: 'Madrid' },
  { id: 'four', question: 'Capital of Japan?', answer: 'Tokyo' },
];

test('builds quizzes with a correct answer and unique options', () => {
  const questions = buildQuiz(cards, { random: () => 0.2 });

  assert.equal(questions.length, cards.length);
  for (const question of questions) {
    assert.ok(question.options.includes(question.correctAnswer));
    assert.ok(question.options.length <= 4);
    assert.equal(new Set(question.options.map((option) => option.toLowerCase())).size, question.options.length);
  }
});

test('scores correct and incorrect responses', () => {
  const questions = buildQuiz(cards, { random: () => 0.5 });
  const answers = Object.fromEntries(questions.map((question, index) => [
    question.id,
    index === 0 ? question.correctAnswer : 'not this answer',
  ]));

  assert.deepEqual(scoreQuiz(questions, answers), {
    correct: 1,
    total: 4,
    percentage: 25,
  });
});

test('supports a one-card quiz without inventing distractors', () => {
  const questions = buildQuiz([cards[0]], { random: () => 0 });
  assert.deepEqual(questions[0].options, ['Paris']);
});

test('ignores malformed saved cards instead of crashing quiz startup', () => {
  const questions = buildQuiz([
    ...cards,
    { id: 'broken', question: 'Not usable', answer: 42 },
  ], { random: () => 0 });

  assert.equal(questions.length, cards.length);
  assert.ok(questions.every((question) => question.correctAnswer !== 42));
});
