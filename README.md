# MathBridge AI

**Learn from every mistake.** A web app for grades 6–8 that helps students practice one-step equations (`x + 7 = 15`, `x − 4 = 9`, `3x = 21`, `x ÷ 5 = 6`). When a student gets one wrong, MathBridge works out *which* mistake they made and gives a hint about that mistake, without giving away the answer.

Built by team **BridgeMinds** for the CodeSquad AI Community Sprint.

> Problem statement: We are building MathBridge AI to help middle school students understand one-step equations through personalized feedback, so they can learn from mistakes and improve their skills. We measure success with short pre- and post-quiz scores.

## How it works

1. **Warm-up quiz**: 3 questions, no hints.
2. **Practice**: 12 problems from the team's equation bank. Each wrong answer unlocks more help, one step at a time:
   1. **A hint about the student's mistake**, from the mistake guide (for example, *"It looks like you added 7. But 7 is already being added to x. To undo it, do the opposite."*).
   2. **The next step**, with the student still doing the arithmetic (*"15 − 7 = ?"*).
   3. **A worked example that uses different numbers.**
   4. **The full solution**, offered only after 4 wrong tries.

   Every wrong answer also shows a **"Check it"** line that puts the student's answer back into the equation (*"22 + 7 = 29, but it should equal 15."*).
3. **"Try a similar one"**: after fixing a mistake, the student solves a new problem of the same type on their own. This measures **goal 1**.
4. **Final quiz**: 3 matched questions, so it can be compared with the warm-up (**goal 2**).
5. **Results**: before/after scores, mistakes to watch for, and "was this hint helpful?" votes (**goal 3**). There's also a **Copy summary for my teacher** button, because nothing is saved.

### How mistakes are detected

All of the math is done by `public/engine.js` using exact fractions, not by AI. For every problem, the engine works out the wrong answer each known mistake would produce:

| Equation | Correct | Mistakes it recognizes |
|---|---|---|
| x + a = b | b − a | added instead of subtracting (b + a), sign/order (a − b), copied b, copied a |
| x − a = b | b + a | subtracted instead of adding, sign, wrong order, copied b |
| a·x = b | b ÷ a | multiplied instead of dividing, divided the wrong way (a ÷ b), read 3x as 3 + x, sign, copied b |
| x ÷ a = b | a · b | divided again, flipped, added/subtracted instead of multiplying, sign, copied b |

An answer that is off by 1 or less is treated as an **arithmetic slip**. Any other wrong answer gets a general "what is being done to x? Do the opposite" hint.

`npm test` checks that every problem in the bank is **clean**: the answer is a whole number, and no two mistakes produce the same wrong answer. That way each wrong answer points to exactly one mistake.

## About the AI (please read)

AI hints are **OFF by default**. With AI off, every hint comes from the mistake guide, which the team has checked.

The app *can* use Google Gemini to reword the diagnosed hint in friendlier language. Our research found that **Google's Gemini API terms appear to forbid using the API in apps that are aimed at, or likely to be used by, people under 18.** Before turning AI on for students, check the current terms with your Teaching Fellow: <https://ai.google.dev/gemini-api/terms>

Safeguards when AI is on (`AI_HINTS=on`):

- **Only numbers go to the AI.** The server accepts just the equation and the number the student typed. Free text is rejected, and there are no names, accounts or cookies.
- **The AI gets the verified next step and our diagnosis**, so it doesn't do any math itself.
- **Every AI hint is filtered before a student sees it.** The server rejects it if it contains the answer, an `x = …` statement, any number not in the problem or the student's answer, or too many words. A rejected hint is replaced by the mistake-guide hint.
- **AI hints are labeled** "AI-generated · may contain mistakes".
- **There's a rate limit and an 8-second timeout.** If the AI fails, the student still gets the normal hint.

## Run it on Replit

### Option A: import from GitHub (recommended)
1. Push this folder to a GitHub repo (see below).
2. In Replit, go to **Create App → Import from GitHub**, or open `https://replit.com/github.com/<owner>/mathbridge-ai` in your browser.
3. Click **Run**. The `.replit` file already sets `npm start` on port 3000.
4. Click **Publish** (or **Deploy**) → **Autoscale**. The free Starter plan includes one published app, which goes offline after 30 days and can be republished.

### Option B: build it in a Replit tab
1. In Replit, go to **Create App → Node.js**.
2. Upload this folder's files. Drag them into the Files panel, keeping `public/`, `lib/` and `test/` as folders.
3. Click **Run**, then **Publish → Autoscale**.

### Optional: turn on AI hints
In Replit, open **Tools → Secrets** and add these three (each is a key and a value):
- `GEMINI_API_KEY` = your key from <https://aistudio.google.com/apikey>
- `AI_HINTS` = `on`
- `GEMINI_MODEL` = `gemini-3.5-flash-lite` (optional; this is the default)

When you publish, make sure the published app has the same secrets too.

## Run it on your computer
Requires Node 20 or newer. The app has no dependencies, so there's no `npm install` step.

```bash
npm start      # then open http://localhost:3000
```

```bash
npm test       # checks the equation bank, the mistake detection and the AI output filter
```

## Edit the equation bank
Teachers can edit `public/bank.js`. Each entry looks like `{ id: 'p13', form: 'mul', a: 4, b: 36 }`. The `form` is one of `add`, `sub`, `mul` or `div`. After editing, run `npm test`: it tells you if a problem's answer isn't a whole number or if two mistakes would give the same wrong answer.

## Privacy
- No accounts, names, emails, cookies, analytics or ads.
- Answers stay in the browser tab's memory and are gone when the tab is closed.
- The server doesn't log student answers. With `DEBUG=1` it logs only whether a call to the AI service worked.
- Before sharing the app with students, ask a teacher or parent to try it. That's the community-trust check in our worksheet.

## Files
```
server.js          tiny Node web server (no dependencies) + optional AI route
lib/safety.js      AI output filter
public/engine.js   equation math, mistake guide, hint ladder, problem generator
public/bank.js     team-created practice + quiz problems
public/app.js      screens: quiz → practice → quiz → results
public/index.html, styles.css, icon.svg
test/              node:test unit tests
docs/RESEARCH.md   research report behind the design
.replit            Replit run + deployment settings
```
