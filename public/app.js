// MathBridge AI — front end. All state lives in memory and is gone when the tab closes.
import { showEquation, diagnose, stepHint, workedExample, solutionSteps, similarItem } from './engine.js';
import { PRACTICE, PRE_QUIZ, POST_QUIZ } from './bank.js';

const app = document.getElementById('app');
const progressEl = document.getElementById('progress');
const MIN_PRACTICE = 6; // problems before "Finish practice" appears

let AI_ON = false;
fetch('api/config').then((r) => r.json()).then((c) => {
  AI_ON = !!c.ai;
  document.getElementById('ai-note').textContent = AI_ON
    ? 'Some hints are reworded by AI (Google Gemini). Those are labeled "AI-generated" and may contain mistakes. AI only sees the equation and the number you typed.'
    : 'AI rewording is currently turned off, so every hint comes from the checked mistake guide.';
}).catch(() => {});

const about = document.getElementById('about');
document.getElementById('about-link').addEventListener('click', (e) => { e.preventDefault(); about.showModal(); });

// ---------- state ----------
const fresh = () => ({
  pre: [], post: [],
  practice: [], // { id, firstTry, mistakes:[ids], solved, shown, similar: null|true|false }
  votes: { up: 0, down: 0 },
  index: 0,
});
let S = fresh();

const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function mount(node) { app.replaceChildren(node); app.focus({ preventScroll: true }); window.scrollTo({ top: 0 }); }
function setProgress(t) { progressEl.textContent = t || ''; }

// ---------- answer box (shared) ----------
function answerBox(onSubmit, label = 'Check') {
  const form = el(`
    <form class="answer-form" autocomplete="off">
      <label for="ans">x =</label>
      <input id="ans" name="ans" inputmode="decimal" enterkeyhint="done" aria-label="Your answer for x" maxlength="10" required>
      <button class="btn" type="submit">${label}</button>
    </form>`);
  const keys = el(`<div class="keys" aria-label="Extra keys">
      <button type="button" class="key" data-k="−" aria-label="Type a minus sign">−</button>
      <button type="button" class="key" data-k="/" aria-label="Type a fraction bar">/</button>
      <button type="button" class="key" data-k="⌫" aria-label="Clear">Clear</button>
    </div>`);
  const input = form.querySelector('input');
  keys.addEventListener('click', (e) => {
    const k = e.target.closest('[data-k]')?.dataset.k; if (!k) return;
    if (k === '⌫') input.value = '';
    else if (k === '−') input.value = input.value.startsWith('-') || input.value.startsWith('−') ? input.value.slice(1) : '-' + input.value;
    else input.value += k;
    input.focus();
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); if (input.value.trim()) onSubmit(input.value.trim(), input); });
  const wrap = document.createElement('div'); wrap.append(form, keys);
  return { node: wrap, input };
}

// ---------- screens ----------
function home() {
  setProgress('');
  S = fresh();
  mount(el(`
    <section>
      <div class="card">
        <p class="eyebrow">Grades 6–8 · One-step equations</p>
        <h1>Learn from every mistake.</h1>
        <p>Solve equations like <b>x + 7 = 15</b> or <b>3x = 21</b>. If you get one wrong, MathBridge figures out <em>what</em> went wrong and gives you a hint about that — not the answer.</p>
        <ol class="steps-list">
          <li><span class="n">1</span><span><b>Warm-up quiz</b> — 3 questions, no hints. Just show what you know.</span></li>
          <li><span class="n">2</span><span><b>Practice</b> — up to 12 problems with personal hints. Try again as many times as you like.</span></li>
          <li><span class="n">3</span><span><b>Final quiz</b> — 3 new questions to see how much you grew.</span></li>
        </ol>
        <div class="row"><button class="btn" id="go">Start the warm-up</button></div>
        <p class="notice">No sign-up. Nothing you type is saved. Takes about 15 minutes.</p>
      </div>
    </section>`));
  app.querySelector('#go').addEventListener('click', () => quiz('pre', 0));
}

function quiz(which, i) {
  const items = which === 'pre' ? PRE_QUIZ : POST_QUIZ;
  const label = which === 'pre' ? 'Warm-up quiz' : 'Final quiz';
  setProgress(`${label} · ${i + 1} of ${items.length}`);
  const item = items[i];
  const card = el(`
    <section class="card">
      <p class="eyebrow">${label} — question ${i + 1} of ${items.length}</p>
      <p class="muted">No hints in the quiz. Do your best!</p>
      <div class="equation" aria-label="Equation">${esc(showEquation(item))}</div>
      <div id="box"></div>
      <div class="feedback" id="fb" role="status"></div>
    </section>`);
  const fb = card.querySelector('#fb');
  const box = answerBox((val) => {
    const d = diagnose(item, val);
    if (d.kind === 'unreadable') { fb.className = 'feedback hint'; fb.textContent = d.hint; return; }
    S[which][i] = d.correct;
    if (i + 1 < items.length) quiz(which, i + 1);
    else if (which === 'pre') intro();
    else results();
  }, 'Next');
  card.querySelector('#box').append(box.node);
  mount(card);
  box.input.focus();
}

function intro() {
  setProgress('');
  mount(el(`
    <section class="card">
      <p class="eyebrow">Warm-up done</p>
      <h2>Now let's practice.</h2>
      <p>When an answer isn't right, you'll get a hint about your <em>specific</em> mistake. Every wrong answer unlocks more help:</p>
      <ol class="steps-list">
        <li><span class="n">1</span><span>A hint about what went wrong</span></li>
        <li><span class="n">2</span><span>The step to take next</span></li>
        <li><span class="n">3</span><span>A worked example with different numbers</span></li>
      </ol>
      <p class="muted">Tip: you can always check an answer by putting it back into the equation.</p>
      <button class="btn" id="go">Start practice</button>
    </section>`));
  app.querySelector('#go').addEventListener('click', () => practice(0));
}

function practice(i, opts = {}) {
  const { similarOf = null } = opts;
  const item = similarOf ? similarItem(similarOf) : PRACTICE[i];
  const rec = similarOf ? null : (S.practice[i] = { id: item.id, firstTry: null, mistakes: [], solved: false, shown: false, similar: null });
  let wrong = 0;
  setProgress(similarOf ? `Practice · bonus problem` : `Practice · ${i + 1} of ${PRACTICE.length}`);

  const card = el(`
    <section class="card">
      <p class="eyebrow">${similarOf ? 'Try a similar one — on your own' : `Practice problem ${i + 1} of ${PRACTICE.length}`}</p>
      <div class="equation" aria-label="Equation">${esc(showEquation(item))}</div>
      <div id="box"></div>
      <div class="feedback" id="fb" role="status" aria-live="polite"></div>
      <div class="row" id="nav" style="margin-top:16px"></div>
    </section>`);
  const fb = card.querySelector('#fb');
  const nav = card.querySelector('#nav');

  const next = () => {
    if (i + 1 < PRACTICE.length) practice(i + 1); else finishPractice();
  };
  const navButtons = () => {
    nav.replaceChildren();
    if (!similarOf && i + 1 >= MIN_PRACTICE && i + 1 < PRACTICE.length) {
      const f = el(`<button class="btn ghost small" type="button">Finish practice → final quiz</button>`);
      f.addEventListener('click', finishPractice); nav.append(f);
    }
  };
  navButtons();

  const box = answerBox(async (val, input) => {
    const d = diagnose(item, val);
    if (d.kind === 'unreadable') { fb.className = 'feedback hint'; fb.innerHTML = `<div class="title">Hmm</div>${esc(d.hint)}`; return; }

    if (d.correct) {
      input.disabled = true; card.querySelector('.answer-form button').disabled = true;
      if (similarOf) { opts.parentRec.similar = wrong === 0; }
      else { rec.solved = !rec.shown; if (rec.firstTry === null) rec.firstTry = true; }
      fb.className = 'feedback good';
      fb.innerHTML = `<div class="title">✓ Correct! x = ${esc(val)}</div>
        <p>${wrong === 0 ? 'Nice work — first try.' : 'You fixed it. That is how learning works.'}</p>`;
      const row = el(`<div class="row"></div>`);
      if (!similarOf && rec.mistakes.length > 0 && rec.similar === null) {
        const sim = el(`<button class="btn" type="button">Try a similar one</button>`);
        sim.addEventListener('click', () => practice(i, { similarOf: item, parentRec: rec, returnTo: i }));
        row.append(sim);
      }
      const nx = el(`<button class="btn ${!similarOf && rec.mistakes.length ? 'ghost' : ''}" type="button">${(similarOf ? opts.returnTo : i) + 1 < PRACTICE.length ? 'Next problem →' : 'Go to final quiz →'}</button>`);
      nx.addEventListener('click', () => (similarOf ? (opts.returnTo + 1 < PRACTICE.length ? practice(opts.returnTo + 1) : finishPractice()) : next()));
      row.append(nx);
      fb.append(row);
      if (!similarOf && rec.mistakes.length) fb.append(voteRow());
      nx.focus();
      return;
    }

    wrong++;
    if (!similarOf) { if (rec.firstTry === null) rec.firstTry = false; rec.mistakes.push(d.mistakeId); }
    fb.className = 'feedback hint';
    fb.innerHTML = `<div class="title">Not quite <span class="tag rules">Mistake guide</span></div>
      <p class="hint-text">${esc(d.hint)}</p>
      ${d.check ? `<p class="check">${esc(d.check)}</p>` : ''}`;

    // Optional AI rewording (server decides whether it's on; output is filtered server-side).
    if (AI_ON && d.kind !== 'unreadable') {
      const p = fb.querySelector('.hint-text');
      p.classList.add('muted'); p.textContent = 'Thinking about your answer…';
      try {
        const r = await fetch('api/hint', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ form: item.form, a: item.a, b: item.b, answer: val }) });
        const j = await r.json();
        if (j.source === 'ai' && j.hint) {
          p.textContent = j.hint;
          fb.querySelector('.tag').className = 'tag ai';
          fb.querySelector('.tag').textContent = 'AI-generated · may contain mistakes';
        } else p.textContent = d.hint;
      } catch { p.textContent = d.hint; }
      p.classList.remove('muted');
    }

    // Hint ladder
    if (wrong >= 2) fb.append(el(`<div class="extra"><b>Next step:</b> ${esc(stepHint(item))}</div>`));
    if (wrong >= 3) {
      const ex = workedExample(item);
      fb.append(el(`<div class="extra"><b>Worked example (different numbers):</b><ol>${ex.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>`));
    }
    if (wrong >= 4 && !similarOf) {
      const show = el(`<div class="extra"><button class="btn ghost small" type="button">Show me the solution</button></div>`);
      show.querySelector('button').addEventListener('click', () => {
        rec.shown = true;
        show.innerHTML = `<b>Solution:</b><ol>${solutionSteps(item).map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
          <p class="muted">Type the answer above to move on — then try a similar one on your own.</p>`;
      });
      fb.append(show);
    }
    input.select();
  });
  card.querySelector('#box').append(box.node);
  mount(card);
  box.input.focus();
}

function voteRow() {
  const v = el(`<div class="vote"><span>Was the hint helpful?</span>
    <button class="btn ghost small" data-v="up" aria-label="Yes, helpful">👍 Yes</button>
    <button class="btn ghost small" data-v="down" aria-label="No, not helpful">👎 No</button></div>`);
  v.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    S.votes[b.dataset.v]++;
    v.innerHTML = '<span>Thanks for the feedback!</span>';
  });
  return v;
}

function finishPractice() {
  setProgress('');
  mount(el(`
    <section class="card">
      <p class="eyebrow">Practice done</p>
      <h2>Final quiz time.</h2>
      <p>3 new questions, no hints. Show what you learned!</p>
      <button class="btn" id="go">Start the final quiz</button>
    </section>`));
  app.querySelector('#go').addEventListener('click', () => quiz('post', 0));
}

function results() {
  setProgress('Results');
  const pre = S.pre.filter(Boolean).length, post = S.post.filter(Boolean).length;
  const done = S.practice.filter(Boolean);
  const firstTry = done.filter((r) => r.firstTry).length;
  const fixed = done.filter((r) => r.mistakes.length && r.solved).length;
  const simTried = done.filter((r) => r.similar !== null);
  const simOk = simTried.filter((r) => r.similar).length;
  const counts = {};
  done.forEach((r) => r.mistakes.forEach((m) => { counts[m] = (counts[m] || 0) + 1; }));
  const NAMES = { 'same-op': 'Used the same operation instead of the opposite', sign: 'Sign (+/−) mix-ups', order: 'Subtracted in the wrong order',
    copied: 'Copied a number from the equation', 'copied-a': 'Copied a number from the equation', flipped: 'Divided the wrong way around',
    'add-sub': 'Added/subtracted instead of multiplying/dividing', 'add-add': 'Added/subtracted instead of multiplying/dividing',
    slip: 'Small arithmetic slips', ambiguous: 'Other', unknown: 'Other' };
  const grouped = {};
  Object.entries(counts).forEach(([k, n]) => { const name = NAMES[k] || 'Other'; grouped[name] = (grouped[name] || 0) + n; });
  const top = Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const msg = post > pre ? 'You improved from the warm-up. 🎉' : post === pre && post === 3 ? 'Perfect both times!' : post === pre ? 'Same score as the warm-up — more practice will help.' : 'Tough quiz — try another round of practice.';
  const summary = [
    'MathBridge AI — session summary (no names saved)',
    `Warm-up quiz: ${pre}/3   Final quiz: ${post}/3`,
    `Practice problems: ${done.length} · first try: ${firstTry} · fixed after a hint: ${fixed}`,
    `Similar problem solved on own after feedback: ${simOk}/${simTried.length}`,
    `Hint helpful votes: 👍 ${S.votes.up} 👎 ${S.votes.down}`,
    top.length ? `Most common mistakes: ${top.map(([k, n]) => `${k} (${n})`).join('; ')}` : 'No mistakes in practice!',
  ].join('\n');

  const pct = (n) => Math.round((n / 3) * 100);
  const card = el(`
    <section class="card">
      <p class="eyebrow">Results</p>
      <h2>${msg}</h2>
      <div class="bars" aria-label="Quiz scores">
        <div class="bar"><span>Warm-up</span><div class="track"><div class="fill" style="width:${pct(pre)}%"></div></div><b>${pre}/3</b></div>
        <div class="bar"><span>Final</span><div class="track"><div class="fill post" style="width:${pct(post)}%"></div></div><b>${post}/3</b></div>
      </div>
      <div class="score-grid">
        <div class="stat"><div class="v">${firstTry}/${done.length}</div><div class="l">practice problems right on the first try</div></div>
        <div class="stat"><div class="v">${fixed}</div><div class="l">mistakes you fixed after a hint</div></div>
        <div class="stat"><div class="v">${simOk}/${simTried.length}</div><div class="l">similar problems solved on your own</div></div>
      </div>
      ${top.length ? `<h3>What to watch for</h3><ul>${top.map(([k, n]) => `<li>${esc(k)} <span class="muted">(${n}×)</span></li>`).join('')}</ul>` : ''}
      <p class="notice">This summary is not saved anywhere. If your teacher asked for it, copy it before you close the tab.</p>
      <div class="row">
        <button class="btn" id="copy">Copy summary for my teacher</button>
        <button class="btn ghost" id="again">Start over</button>
      </div>
    </section>`);
  card.querySelector('#copy').addEventListener('click', async (e) => {
    try { await navigator.clipboard.writeText(summary); e.target.textContent = 'Copied ✓'; }
    catch { window.prompt('Copy this summary:', summary); }
  });
  card.querySelector('#again').addEventListener('click', home);
  mount(card);
}

home();
