// MathBridge AI — equation engine.
// Pure functions, shared by the browser and the server (ES module, no dependencies).
// All math is done here with exact fractions. The AI never does arithmetic.

// ---------- Exact fractions ----------
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };

export function frac(n, d = 1) {
  if (d === 0) return null;
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
const add = (x, y) => frac(x.n * y.d + y.n * x.d, x.d * y.d);
const sub = (x, y) => frac(x.n * y.d - y.n * x.d, x.d * y.d);
const mul = (x, y) => frac(x.n * y.n, x.d * y.d);
const div = (x, y) => (y.n === 0 ? null : frac(x.n * y.d, x.d * y.n));
const neg = (x) => frac(-x.n, x.d);
export const same = (x, y) => !!x && !!y && x.n === y.n && x.d === y.d;
const I = (k) => frac(k, 1);

export function fmt(x) {
  if (!x) return '?';
  const s = x.d === 1 ? String(Math.abs(x.n)) : `${Math.abs(x.n)}/${x.d}`;
  return x.n < 0 ? `−${s}` : s;
}
const num = (k) => (k < 0 ? `(−${-k})` : String(k)); // number inside an expression
const plain = (k) => (k < 0 ? `−${-k}` : String(k)); // number standing alone

// Parse what a student types: "5", "-3", "−3", "2.5", "-3/4", "x = 7", "x=-2"
export function parseAnswer(raw) {
  if (typeof raw !== 'string') return null;
  let s = raw.trim().replace(/[−–—]/g, '-').replace(/\s+/g, '').toLowerCase();
  s = s.replace(/^x=/, '');
  if (s.length === 0 || s.length > 12) return null;
  let m = s.match(/^(-?)(\d+)\/(\d+)$/);
  if (m) { const n = parseInt(m[2], 10) * (m[1] ? -1 : 1); return frac(n, parseInt(m[3], 10)); }
  m = s.match(/^(-?)(\d*)\.?(\d*)$/);
  if (m && (m[2] || m[3])) {
    const dec = m[3] || '';
    const n = parseInt((m[2] || '0') + dec, 10) * (m[1] ? -1 : 1);
    return frac(n, 10 ** dec.length);
  }
  return null;
}

// ---------- Equation forms ----------
// add: x + a = b    sub: x − a = b    mul: a·x = b    div: x / a = b
export const FORMS = {
  add: {
    show: (a, b) => `x + ${num(a)} = ${plain(b)}`,
    lhs: (a, x) => add(x, I(a)),
    lhsText: (a, x) => `${fmtIn(x)} + ${num(a)}`,
    solve: (a, b) => sub(I(b), I(a)),
    doing: (a) => `${plain(a)} is being added to x`,
    undo: (a) => `subtract ${plain(a)} from both sides`,
    undoOp: 'subtraction',
  },
  sub: {
    show: (a, b) => `x − ${num(a)} = ${plain(b)}`,
    lhs: (a, x) => sub(x, I(a)),
    lhsText: (a, x) => `${fmtIn(x)} − ${num(a)}`,
    solve: (a, b) => add(I(b), I(a)),
    doing: (a) => `${plain(a)} is being subtracted from x`,
    undo: (a) => `add ${plain(a)} to both sides`,
    undoOp: 'addition',
  },
  mul: {
    show: (a, b) => `${a === -1 ? '−' : plain(a)}x = ${plain(b)}`,
    lhs: (a, x) => mul(I(a), x),
    lhsText: (a, x) => `${plain(a)} × ${fmtIn(x)}`,
    solve: (a, b) => div(I(b), I(a)),
    doing: (a) => `x is being multiplied by ${plain(a)}`,
    undo: (a) => `divide both sides by ${plain(a)}`,
    undoOp: 'division',
  },
  div: {
    show: (a, b) => `x ÷ ${num(a)} = ${plain(b)}`,
    lhs: (a, x) => div(x, I(a)),
    lhsText: (a, x) => `${fmtIn(x)} ÷ ${num(a)}`,
    solve: (a, b) => mul(I(b), I(a)),
    doing: (a) => `x is being divided by ${plain(a)}`,
    undo: (a) => `multiply both sides by ${plain(a)}`,
    undoOp: 'multiplication',
  },
};
function fmtIn(x) { const s = fmt(x); return x.n < 0 ? `(${s})` : s; }

export const showEquation = (item) => FORMS[item.form].show(item.a, item.b);
export const solve = (item) => FORMS[item.form].solve(item.a, item.b);

// ---------- Mistake guide ----------
// Each entry: the wrong answer a misconception produces, and a hint that names it
// without giving the answer. Based on documented error patterns (see docs/RESEARCH.md).
const MISTAKES = {
  add: [
    { id: 'same-op', value: (a, b) => add(I(b), I(a)),
      hint: (a) => `It looks like you added ${plain(a)}. But ${plain(a)} is already being added to x — to undo it, do the opposite: ${FORMS.add.undo(a)}.` },
    { id: 'sign', value: (a, b) => sub(I(a), I(b)),
      hint: (a, b) => `You used the right numbers, but check the sign and the order. Start from the right side: ${plain(b)} minus ${plain(a)} — is that positive or negative?` },
    { id: 'copied', value: (a, b) => I(b),
      hint: (a, b) => `${plain(b)} is the total on the right side, not x. Something is still being done to x — ${FORMS.add.undo(a)}.` },
    { id: 'copied-a', value: (a) => I(a),
      hint: (a) => `${plain(a)} is the number added to x, not x itself. Undo it: ${FORMS.add.undo(a)}.` },
  ],
  sub: [
    { id: 'same-op', value: (a, b) => sub(I(b), I(a)),
      hint: (a) => `It looks like you subtracted ${plain(a)}. But ${plain(a)} is already being subtracted from x — to undo it, do the opposite: ${FORMS.sub.undo(a)}.` },
    { id: 'sign', value: (a, b) => neg(add(I(b), I(a))),
      hint: () => `Your number is close, but check the sign. Is your answer supposed to be positive or negative?` },
    { id: 'order', value: (a, b) => sub(I(a), I(b)),
      hint: (a) => `Check the order. Keep the right side first, then ${FORMS.sub.undo(a)}.` },
    { id: 'copied', value: (a, b) => I(b),
      hint: (a, b) => `${plain(b)} is what's left after the subtraction, not x. ${cap(FORMS.sub.undo(a))}.` },
  ],
  mul: [
    { id: 'same-op', value: (a, b) => mul(I(a), I(b)),
      hint: (a) => `It looks like you multiplied by ${plain(a)}. But x is already being multiplied by ${plain(a)} — to undo it, do the opposite: ${FORMS.mul.undo(a)}.` },
    { id: 'flipped', value: (a, b) => div(I(a), I(b)),
      hint: (a, b) => `You divided, which is the right idea — but the wrong way around. Divide the right side by ${plain(a)}: ${plain(b)} ÷ ${plain(a)}, not ${plain(a)} ÷ ${plain(b)}.` },
    { id: 'add-sub', value: (a, b) => sub(I(b), I(a)),
      hint: (a) => `${plain(a)}x means ${plain(a)} times x, not ${plain(a)} plus x. Undo multiplication with division: ${FORMS.mul.undo(a)}.` },
    { id: 'sign', value: (a, b) => neg(div(I(b), I(a))),
      hint: () => `Right size, wrong sign. Remember: when you divide, a positive and a negative give a negative; two negatives give a positive.` },
    { id: 'copied', value: (a, b) => I(b),
      hint: (a, b) => `${plain(b)} is the product, not x. ${cap(FORMS.mul.undo(a))}.` },
  ],
  div: [
    { id: 'same-op', value: (a, b) => div(I(b), I(a)),
      hint: (a) => `It looks like you divided by ${plain(a)}. But x is already being divided by ${plain(a)} — to undo it, do the opposite: ${FORMS.div.undo(a)}.` },
    { id: 'flipped', value: (a, b) => div(I(a), I(b)),
      hint: (a) => `Dividing is what's being done to x, so dividing again won't undo it. Undo division with multiplication: ${FORMS.div.undo(a)}.` },
    { id: 'add-sub', value: (a, b) => sub(I(b), I(a)),
      hint: (a) => `The ÷ sign means division, so subtracting won't undo it. ${cap(FORMS.div.undo(a))}.` },
    { id: 'add-add', value: (a, b) => add(I(b), I(a)),
      hint: (a) => `Undo division with multiplication, not addition: ${FORMS.div.undo(a)}.` },
    { id: 'sign', value: (a, b) => neg(mul(I(b), I(a))),
      hint: () => `Right size, wrong sign. When you multiply, a positive and a negative give a negative; two negatives give a positive.` },
    { id: 'copied', value: (a, b) => I(b),
      hint: (a, b) => `${plain(b)} is the result after dividing, not x. ${cap(FORMS.div.undo(a))}.` },
  ],
};
function cap(s) { return s[0].toUpperCase() + s.slice(1); }

// All "wrong answers" that a known mistake would produce for this item.
function candidates(item) {
  return MISTAKES[item.form].map((m) => ({ id: m.id, value: m.value(item.a, item.b) }));
}

// An item is "clean" if every known mistake gives a different wrong answer,
// so a wrong answer points to exactly one mistake.
export function isClean(item) {
  const c = solve(item);
  if (!c || c.d !== 1) return false; // practice answers are whole numbers
  const vals = candidates(item).map((m) => m.value).filter(Boolean);
  const all = [c, ...vals];
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) if (same(all[i], all[j])) return false;
  return true;
}

// Diagnose one answer. Returns { correct, kind, mistakeId, hint, check }.
export function diagnose(item, raw) {
  const ans = typeof raw === 'string' ? parseAnswer(raw) : raw;
  if (!ans) return { correct: false, kind: 'unreadable', hint: 'Type a number, like 7, −3, or 1/2.' };
  const c = solve(item);
  if (same(ans, c)) return { correct: true, kind: 'correct' };
  const F = FORMS[item.form];
  const left = F.lhs(item.a, ans);
  const check = `Check it: ${F.lhsText(item.a, ans)} = ${fmt(left)}, but it should equal ${plain(item.b)}.`;
  const matches = MISTAKES[item.form].filter((m) => same(m.value(item.a, item.b), ans));
  if (matches.length === 1) {
    const m = matches[0];
    return { correct: false, kind: 'mistake', mistakeId: m.id, hint: m.hint(item.a, item.b), check };
  }
  if (matches.length > 1) {
    return { correct: false, kind: 'mistake', mistakeId: 'ambiguous',
      hint: `Ask yourself: what is being done to x? Then do the opposite to both sides: ${F.undo(item.a)}.`, check };
  }
  // Close but not exact → probably an arithmetic slip.
  const diff = sub(ans, c);
  if (Math.abs(diff.n) <= diff.d) {
    return { correct: false, kind: 'slip', mistakeId: 'slip',
      hint: `You're very close! Your plan may be right — recheck your arithmetic.`, check };
  }
  return { correct: false, kind: 'unknown', mistakeId: 'unknown',
    hint: `${cap(F.doing(item.a))}. To get x alone, do the opposite: ${F.undo(item.a)}.`, check };
}

// Hint ladder. Level 1 = diagnosed hint. Level 2 = the step to take (student still does the math).
// Level 3 = a worked example with DIFFERENT numbers. No level reveals this problem's answer.
export function stepHint(item) {
  const F = FORMS[item.form];
  const opText = {
    add: `${plain(item.b)} − ${num(item.a)}`,
    sub: `${plain(item.b)} + ${num(item.a)}`,
    mul: `${plain(item.b)} ÷ ${num(item.a)}`,
    div: `${plain(item.b)} × ${num(item.a)}`,
  }[item.form];
  return `${cap(F.doing(item.a))}, so ${F.undo(item.a)}. On the right side that means: ${opText} = ?`;
}

export function workedExample(item, rng = Math.random) {
  const ex = similarItem(item, rng);
  const F = FORMS[ex.form];
  const c = solve(ex);
  const steps = [
    `Example: ${showEquation(ex)}`,
    `${cap(F.doing(ex.a))}, so ${F.undo(ex.a)}.`,
    `x = ${fmt(c)}`,
    `Check: ${F.lhsText(ex.a, c)} = ${plain(ex.b)} ✓`,
  ];
  return { example: ex, steps };
}

export function solutionSteps(item) {
  const F = FORMS[item.form];
  const c = solve(item);
  return [
    `${cap(F.doing(item.a))}.`,
    `${cap(F.undo(item.a))}.`,
    `x = ${fmt(c)}`,
    `Check: ${F.lhsText(item.a, c)} = ${plain(item.b)} ✓`,
  ];
}

// ---------- Generating similar problems ----------
const rint = (lo, hi, rng) => lo + Math.floor(rng() * (hi - lo + 1));

export function makeItem(form, { negatives = false } = {}, rng = Math.random) {
  for (let tries = 0; tries < 500; tries++) {
    let item;
    const sgn = () => (negatives && rng() < 0.4 ? -1 : 1);
    if (form === 'add' || form === 'sub') {
      const x = rint(2, 20, rng) * sgn();
      const a = rint(2, 15, rng) * sgn();
      const b = form === 'add' ? x + a : x - a;
      item = { form, a, b };
    } else {
      const x = rint(2, 12, rng) * sgn();
      const a = rint(2, 9, rng) * sgn();
      // mul: a·x = b.  div: x ÷ a = b, so x = a·b (pick b directly to keep x whole)
      item = form === 'mul' ? { form, a, b: a * x } : { form, a, b: rint(2, 9, rng) * sgn() };
    }
    if (Number.isInteger(item.b) && isClean(item)) return item;
  }
  throw new Error('could not generate item');
}

export function similarItem(item, rng = Math.random) {
  const negatives = item.a < 0 || item.b < 0 || solve(item).n < 0;
  for (let i = 0; i < 50; i++) {
    const s = makeItem(item.form, { negatives }, rng);
    if (!(s.a === item.a && s.b === item.b)) return s;
  }
  return makeItem(item.form, { negatives }, rng);
}
