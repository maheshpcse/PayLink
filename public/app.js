import { parseNotes } from '/src/parser.mjs';
import { buildQuiz, scoreQuiz } from '/src/quiz.mjs';

const STORAGE_KEY = 'notedeck-state-v1';
const EXAMPLE_NOTES = `# Biology

Q: What is osmosis?
A: The movement of water across a selectively permeable membrane.

Q: What is the role of chlorophyll?
A: It absorbs light energy for photosynthesis.

- **Mitochondria**: Organelles that produce ATP for the cell.
- **Photosynthesis**: The process plants use to turn light into chemical energy.`;

const elements = {
  notesInput: document.querySelector('#notesInput'),
  notesFile: document.querySelector('#notesFile'),
  inputStatus: document.querySelector('#inputStatus'),
  warnings: document.querySelector('#warnings'),
  generateButton: document.querySelector('#generateButton'),
  exampleButton: document.querySelector('#exampleButton'),
  exportButton: document.querySelector('#exportButton'),
  importButton: document.querySelector('#importButton'),
  importFile: document.querySelector('#importFile'),
  clearButton: document.querySelector('#clearButton'),
  studyTab: document.querySelector('#studyTab'),
  quizTab: document.querySelector('#quizTab'),
  studyView: document.querySelector('#studyView'),
  quizView: document.querySelector('#quizView'),
  studyProgress: document.querySelector('#studyProgress'),
  flashcard: document.querySelector('#flashcard'),
  cardControls: document.querySelector('#cardControls'),
  revealButton: document.querySelector('#revealButton'),
  ratingControls: document.querySelector('#ratingControls'),
  againButton: document.querySelector('#againButton'),
  correctButton: document.querySelector('#correctButton'),
  studyHint: document.querySelector('#studyHint'),
  quizProgress: document.querySelector('#quizProgress'),
  quizCard: document.querySelector('#quizCard'),
  quizActions: document.querySelector('#quizActions'),
  submitAnswerButton: document.querySelector('#submitAnswerButton'),
  retryButton: document.querySelector('#retryButton'),
};

let cards = [];
let notes = '';
let studyIndex = 0;
let answerVisible = false;
let quizQuestions = [];
let quizIndex = 0;
let quizAnswers = {};
let quizFinished = false;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || !Array.isArray(saved.cards)) return;
    notes = typeof saved.notes === 'string' ? saved.notes : '';
    cards = saved.cards.filter((card) => card && card.id && card.question && card.answer);
    elements.notesInput.value = notes;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ notes, cards }));
}

function showStatus(message, isError = false) {
  elements.inputStatus.textContent = message;
  elements.inputStatus.style.color = isError ? '#a25235' : '';
}

function renderWarnings(warnings = []) {
  elements.warnings.replaceChildren();
  for (const warning of warnings) {
    const paragraph = document.createElement('p');
    paragraph.textContent = `Note: ${warning}`;
    elements.warnings.append(paragraph);
  }
}

function renderFlashcard() {
  if (cards.length === 0) {
    elements.studyProgress.textContent = 'No cards yet';
    elements.flashcard.innerHTML = `<div class="empty-card"><span class="empty-icon">✦</span><h3>Your first deck is waiting.</h3><p>Paste your notes above and choose <strong>Generate flashcards</strong>.</p></div>`;
    elements.cardControls.hidden = true;
    elements.studyHint.textContent = 'Read the question out loud before revealing the answer.';
    return;
  }

  const card = cards[studyIndex % cards.length];
  elements.studyProgress.textContent = `${(studyIndex % cards.length) + 1} of ${cards.length}`;
  elements.flashcard.innerHTML = '';

  const content = document.createElement('div');
  content.className = 'flashcard-content';
  const topic = document.createElement('span');
  topic.className = 'topic-label';
  topic.textContent = card.topic || 'General';
  const question = document.createElement('h3');
  question.className = 'question-text';
  question.textContent = card.question;
  content.append(topic, question);

  if (answerVisible) {
    const answerBlock = document.createElement('div');
    answerBlock.className = 'answer-block';
    answerBlock.innerHTML = '<p class="answer-label">Answer</p>';
    const answer = document.createElement('p');
    answer.className = 'answer-text';
    answer.textContent = card.answer;
    answerBlock.append(answer);
    content.append(answerBlock);
  }
  elements.flashcard.append(content);
  elements.cardControls.hidden = false;
  elements.revealButton.hidden = answerVisible;
  elements.ratingControls.hidden = !answerVisible;
  elements.studyHint.textContent = answerVisible ? 'How did that feel? Mark it and keep moving.' : 'Read the question out loud before revealing the answer.';
}

function resetQuiz() {
  quizQuestions = buildQuiz(cards);
  quizIndex = 0;
  quizAnswers = {};
  quizFinished = false;
  renderQuiz();
}

function renderQuiz() {
  if (quizQuestions.length === 0) {
    elements.quizProgress.textContent = 'No quiz yet';
    elements.quizCard.innerHTML = `<div class="empty-card"><span class="empty-icon">☻</span><h3>Your quiz will appear here.</h3><p>Generate flashcards first, then choose an answer for each question.</p></div>`;
    elements.quizActions.hidden = true;
    return;
  }

  elements.quizActions.hidden = false;
  elements.retryButton.hidden = !quizFinished;
  elements.submitAnswerButton.hidden = quizFinished;

  if (quizFinished) {
    const result = scoreQuiz(quizQuestions, quizAnswers);
    elements.quizProgress.textContent = 'Complete';
    elements.quizCard.innerHTML = `<div class="quiz-result"><div class="quiz-result-score">${result.percentage}%</div><p>You got ${result.correct} of ${result.total} correct.</p></div>`;
    return;
  }

  const question = quizQuestions[quizIndex];
  elements.quizProgress.textContent = `${quizIndex + 1} of ${quizQuestions.length}`;
  elements.quizCard.innerHTML = '';
  const number = document.createElement('p');
  number.className = 'quiz-question-number';
  number.textContent = `Question ${quizIndex + 1}`;
  const prompt = document.createElement('h3');
  prompt.className = 'quiz-prompt';
  prompt.textContent = question.prompt;
  const options = document.createElement('div');
  options.className = 'quiz-options';

  question.options.forEach((option, optionIndex) => {
    const label = document.createElement('label');
    label.className = 'quiz-option';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = `question-${question.id}`;
    input.value = option;
    input.checked = quizAnswers[question.id] === option;
    input.addEventListener('change', () => {
      quizAnswers[question.id] = option;
      elements.submitAnswerButton.disabled = false;
    });
    const text = document.createElement('span');
    text.textContent = option;
    label.append(input, text);
    options.append(label);
    if (optionIndex === 0 && question.options.length === 1) {
      elements.submitAnswerButton.disabled = false;
    }
  });
  elements.quizCard.append(number, prompt, options);
  elements.submitAnswerButton.disabled = !quizAnswers[question.id];
}

function generateCards() {
  notes = elements.notesInput.value;
  const parsed = parseNotes(notes);
  cards = parsed.cards;
  studyIndex = 0;
  answerVisible = false;
  saveState();
  renderWarnings(parsed.warnings);
  showStatus(cards.length ? `${cards.length} flashcard${cards.length === 1 ? '' : 's'} ready.` : 'No cards generated.', cards.length === 0);
  renderFlashcard();
  resetQuiz();
}

function showStudy() {
  elements.studyTab.classList.add('is-active');
  elements.quizTab.classList.remove('is-active');
  elements.studyView.classList.remove('is-hidden');
  elements.quizView.classList.add('is-hidden');
}

function showQuiz() {
  elements.quizTab.classList.add('is-active');
  elements.studyTab.classList.remove('is-active');
  elements.quizView.classList.remove('is-hidden');
  elements.studyView.classList.add('is-hidden');
  if (cards.length && quizQuestions.length === 0) resetQuiz();
}

function exportDeck() {
  if (cards.length === 0) {
    showStatus('Generate at least one card before exporting.', true);
    return;
  }
  const payload = JSON.stringify({ notes, cards, exportedAt: new Date().toISOString() }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'notedeck.json';
  link.click();
  URL.revokeObjectURL(link.href);
  showStatus('Deck exported.');
}

function importDeck(file) {
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported.cards) || imported.cards.some((card) => !card.id || !card.question || !card.answer)) {
        throw new Error('That file does not look like a NoteDeck export.');
      }
      cards = imported.cards;
      notes = typeof imported.notes === 'string' ? imported.notes : '';
      elements.notesInput.value = notes;
      studyIndex = 0;
      answerVisible = false;
      saveState();
      renderWarnings([]);
      showStatus(`${cards.length} cards imported.`);
      renderFlashcard();
      resetQuiz();
    } catch (error) {
      showStatus(error.message || 'Could not import that file.', true);
    }
  });
  reader.readAsText(file);
}

elements.generateButton.addEventListener('click', generateCards);
elements.exampleButton.addEventListener('click', () => {
  elements.notesInput.value = EXAMPLE_NOTES;
  generateCards();
});
elements.notesFile.addEventListener('change', () => {
  const [file] = elements.notesFile.files;
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    elements.notesInput.value = reader.result;
    showStatus(`${file.name} loaded. Review it, then generate cards.`);
  });
  reader.readAsText(file);
});
elements.revealButton.addEventListener('click', () => {
  answerVisible = true;
  renderFlashcard();
});
elements.againButton.addEventListener('click', () => {
  studyIndex = (studyIndex + 1) % cards.length;
  answerVisible = false;
  renderFlashcard();
});
elements.correctButton.addEventListener('click', () => {
  studyIndex = (studyIndex + 1) % cards.length;
  answerVisible = false;
  renderFlashcard();
});
elements.studyTab.addEventListener('click', showStudy);
elements.quizTab.addEventListener('click', showQuiz);
elements.submitAnswerButton.addEventListener('click', () => {
  if (!quizAnswers[quizQuestions[quizIndex].id]) return;
  if (quizIndex < quizQuestions.length - 1) {
    quizIndex += 1;
  } else {
    quizFinished = true;
  }
  renderQuiz();
});
elements.retryButton.addEventListener('click', resetQuiz);
elements.exportButton.addEventListener('click', exportDeck);
elements.importButton.addEventListener('click', () => elements.importFile.click());
elements.importFile.addEventListener('change', () => {
  const [file] = elements.importFile.files;
  if (file) importDeck(file);
  elements.importFile.value = '';
});
elements.clearButton.addEventListener('click', () => {
  if (!window.confirm('Clear the saved notes and flashcards from this browser?')) return;
  localStorage.removeItem(STORAGE_KEY);
  notes = '';
  cards = [];
  elements.notesInput.value = '';
  renderWarnings([]);
  showStatus('Saved data cleared.');
  renderFlashcard();
  resetQuiz();
});

loadState();
renderFlashcard();
if (cards.length) resetQuiz();
