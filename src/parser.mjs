function makeId(source, topic) {
  let hash = 2166136261;
  for (const character of `${topic}\n${source}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `card-${(hash >>> 0).toString(16)}`;
}

function addCard(cards, question, answer, topic, source) {
  const cleanQuestion = question.trim();
  const cleanAnswer = answer.trim();
  if (!cleanQuestion || !cleanAnswer) return;

  cards.push({
    id: makeId(source, topic),
    question: cleanQuestion,
    answer: cleanAnswer,
    topic,
    source,
  });
}

/**
 * Parse the small, documented Markdown subset used by the app.
 *
 * Supported cards:
 *   Q: What is ...?
 *   A: It is ...
 *   - **Term**: Definition
 */
export function parseNotes(markdown = '') {
  const text = String(markdown).replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  const cards = [];
  const warnings = [];
  let topic = 'General';
  let inFence = false;
  let pendingQuestion = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (/^```/.test(trimmed)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const heading = trimmed.match(/^#{1,6}\s+(.+?)\s*#*$/);
    if (heading) {
      topic = heading[1].trim();
      continue;
    }

    const question = trimmed.match(/^Q:\s*(.+?)\s*$/i);
    if (question) {
      if (pendingQuestion) {
        warnings.push(`Question on line ${pendingQuestion.line} has no answer.`);
      }
      pendingQuestion = { text: question[1], line: index + 1 };
      continue;
    }

    const answer = trimmed.match(/^A:\s*(.+?)\s*$/i);
    if (answer) {
      if (!pendingQuestion) {
        warnings.push(`Answer on line ${index + 1} has no question.`);
      } else {
        const source = `Q: ${pendingQuestion.text}\nA: ${answer[1]}`;
        addCard(cards, pendingQuestion.text, answer[1], topic, source);
        pendingQuestion = null;
      }
      continue;
    }

    const definition = trimmed.match(/^(?:[-*+]\s+|\d+[.)]\s+)?\*\*(.+?)\*\*\s*:\s*(.+?)\s*$/);
    if (definition) {
      const source = line.trim();
      addCard(cards, definition[1], definition[2], topic, source);
    }
  }

  if (pendingQuestion) {
    warnings.push(`Question on line ${pendingQuestion.line} has no answer.`);
  }
  if (!text.trim()) {
    warnings.push('Add some Markdown notes to generate flashcards.');
  } else if (cards.length === 0) {
    warnings.push('No flashcards found. Use Q:/A: pairs or **Term**: definition lines.');
  }

  return { cards, warnings };
}
