# NoteDeck

NoteDeck is a small, beginner-friendly web app that turns a Markdown file or pasted Markdown notes into flashcards and a quick multiple-choice quiz.

It is intentionally simple:

- Plain HTML, CSS, and JavaScript
- Node.js's built-in web server and test runner
- No database, account, build step, or third-party runtime dependency
- Notes and the generated deck are saved in your browser's `localStorage`
- Import and export let you move a deck as a JSON file

## Requirements

- Node.js **24.19.0** (the version in `.nvmrc`)
- npm (included with Node.js)

No internet connection is needed after Node.js is installed.

## Setup

From the project folder:

```text
npm ci
```

On a machine with an already-populated npm cache, the reproducible offline version is:

```text
npm ci --offline
```

## Run the app

Start the local server:

```text
npm start
```

Then open <http://127.0.0.1:3000> in your browser. Keep the terminal window open while using the app. Press `Ctrl+C` in that window to stop the server.

To use a different port in PowerShell:

```powershell
$env:PORT=3001; npm start
```

Then open <http://127.0.0.1:3001>.

## Run the test

```text
npm test
```

The test checks Markdown parsing, incomplete-note warnings, quiz generation and scoring, one-card quizzes, and the local HTTP server.

## Write notes that become cards

NoteDeck supports two easy formats. A heading becomes the topic shown on a card.

### Question and answer pairs

```markdown
# Biology

Q: What is osmosis?
A: The movement of water across a selectively permeable membrane.
```

### Definition lines

```markdown
## Cell parts

- **Mitochondria**: Organelles that produce ATP for the cell.
- **Nucleus**: The part of a cell that stores genetic material.
```

Fenced code blocks are ignored. If a `Q:` has no matching `A:`, the app keeps the warning visible and does not create a broken card.

## Use the app

1. Paste notes into the large text box, or choose a `.md`/`.markdown` file.
2. Select **Generate flashcards**.
3. In **Flashcards**, think about the question, reveal the answer, and choose **Again** or **Got it**.
4. Select **Quick quiz** and choose an answer for each question.
5. Use **Export deck** for a backup JSON file. **Import deck** restores one of those files.

## Docker

Build and run the app without installing Node.js locally:

```text
docker build -t notedeck .
docker run --rm -p 3000:3000 notedeck
```

Open <http://127.0.0.1:3000>.

## Project layout

```text
server.mjs          Local static-file server
src/parser.mjs      Markdown-to-card parser
src/quiz.mjs        Quiz creation and scoring
public/             Browser UI
test/               Offline Node.js tests
```
