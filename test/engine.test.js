import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnose, isClean, solve, fmt, parseAnswer, makeItem, similarItem, stepHint, workedExample } from '../public/engine.js';
import { PRACTICE, PRE_QUIZ, POST_QUIZ } from '../public/bank.js';

test('every bank item is clean (whole-number answer, mistakes distinguishable)', () => {
  for (const item of [...PRACTICE, ...PRE_QUIZ, ...POST_QUIZ]) {
    assert.ok(isClean(item), `item ${item.id} is not clean (answer ${fmt(solve(item))})`);
  }
});

test('bank ids are unique', () => {
  const ids = [...PRACTICE, ...PRE_QUIZ, ...POST_QUIZ].map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('parses typical student input', () => {
  assert.deepEqual(parseAnswer('8'), { n: 8, d: 1 });
  assert.deepEqual(parseAnswer(' -5 '), { n: -5, d: 1 });
  assert.deepEqual(parseAnswer('−5'), { n: -5, d: 1 });
  assert.deepEqual(parseAnswer('x = 7'), { n: 7, d: 1 });
  assert.deepEqual(parseAnswer('2.5'), { n: 5, d: 2 });
  assert.deepEqual(parseAnswer('-3/4'), { n: -3, d: 4 });
  assert.equal(parseAnswer('eight'), null);
  assert.equal(parseAnswer(''), null);
  assert.equal(parseAnswer('1/0'), null);
});

test('correct answers are accepted in any equivalent form', () => {
  const item = { form: 'mul', a: 3, b: 21 };
  assert.equal(diagnose(item, '7').correct, true);
  assert.equal(diagnose(item, '7.0').correct, true);
  assert.equal(diagnose(item, '14/2').correct, true);
});

test('diagnoses the classic mistakes', () => {
  const cases = [
    [{ form: 'add', a: 7, b: 15 }, '22', 'same-op'],
    [{ form: 'add', a: 7, b: 15 }, '-8', 'sign'],
    [{ form: 'add', a: 7, b: 15 }, '15', 'copied'],
    [{ form: 'sub', a: 4, b: 9 }, '5', 'same-op'],
    [{ form: 'sub', a: 4, b: 9 }, '-13', 'sign'],
    [{ form: 'mul', a: 3, b: 21 }, '63', 'same-op'],
    [{ form: 'mul', a: 3, b: 21 }, '1/7', 'flipped'],
    [{ form: 'mul', a: 3, b: 21 }, '18', 'add-sub'],
    [{ form: 'mul', a: -4, b: 28 }, '7', 'sign'],
    [{ form: 'div', a: 5, b: 6 }, '1.2', 'same-op'],
    [{ form: 'div', a: 5, b: 6 }, '11', 'add-add'],
    [{ form: 'add', a: 7, b: 15 }, '9', 'slip'],
    [{ form: 'add', a: 7, b: 15 }, '100', 'unknown'],
  ];
  for (const [item, ans, id] of cases) {
    const d = diagnose(item, ans);
    assert.equal(d.correct, false);
    assert.equal(d.mistakeId, id, `${JSON.stringify(item)} answer ${ans}`);
    assert.ok(d.check.includes('should equal'));
  }
});

test('no hint, step hint, or check line ever states the answer to this problem', () => {
  for (const item of PRACTICE) {
    const answer = fmt(solve(item));
    const re = new RegExp(`(^|[^\\d/.])${answer.replace('−', '−?')}($|[^\\d/.])`);
    const wrongs = ['0', '100', '999', String(item.b), String(item.a * 2 + 1)];
    for (const w of wrongs) {
      const d = diagnose(item, w);
      if (d.correct) continue;
      assert.ok(!/x = /.test(d.hint), `hint gives x = for ${item.id}`);
    }
    assert.ok(!stepHint(item).includes(`= ${answer}`), `step hint reveals answer for ${item.id}`);
    const ex = workedExample(item);
    assert.ok(!(ex.example.a === item.a && ex.example.b === item.b), 'worked example must use different numbers');
  }
});

test('generated items are clean and in range', () => {
  for (const form of ['add', 'sub', 'mul', 'div']) {
    for (let i = 0; i < 300; i++) {
      const it = makeItem(form, { negatives: i % 2 === 0 });
      assert.ok(isClean(it));
      assert.ok(Math.abs(solve(it).n) <= 120);
    }
  }
  const s = similarItem(PRACTICE[0]);
  assert.equal(s.form, 'add');
});

import { safeAiHint } from '../lib/safety.js';
test('AI output filter blocks answers and made-up numbers', () => {
  const item = { form: 'add', a: 7, b: 15 }; // x = 8
  assert.ok(safeAiHint('You added 7 instead of undoing it. What do you get if you subtract 7 from both sides?', item, '22'));
  assert.equal(safeAiHint('Subtract 7 from 15 to get 8. Try again?', item, '22'), null);
  assert.equal(safeAiHint('So x = 8 is the answer here, okay friend?', item, '22'), null);
  assert.equal(safeAiHint('Try thinking about 42 and what that means here today?', item, '22'), null);
  assert.equal(safeAiHint('', item, '22'), null);
});

test('AI filter blocks the answer spelled out', () => {
  assert.equal(safeAiHint('Great try! The number you want is eight, so try that now please?', { form: 'add', a: 7, b: 15 }, '22'), null);
});
