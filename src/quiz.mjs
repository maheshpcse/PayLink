function shuffle(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function uniqueAnswers(cards, currentId) {
  const answers = [];
  const seen = new Set();
  for (const card of cards) {
    if (card.id === currentId) continue;
    const key = card.answer.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      answers.push(card.answer);
    }
  }
  return answers;
}

export function buildQuiz(cards = [], { count = cards.length, random = Math.random } = {}) {
  const selected = shuffle(cards, random).slice(0, Math.max(0, count));

  return selected.map((card) => {
    const distractors = uniqueAnswers(cards, card.id).slice(0, 3);
    const options = shuffle([card.answer, ...distractors], random);
    return {
      id: card.id,
      prompt: card.question,
      correctAnswer: card.answer,
      options,
    };
  });
}

export function scoreQuiz(questions, answers) {
  const total = questions.length;
  const correct = questions.reduce((score, question) => (
    answers[question.id] === question.correctAnswer ? score + 1 : score
  ), 0);

  return {
    correct,
    total,
    percentage: total === 0 ? 0 : Math.round((correct / total) * 100),
  };
}
