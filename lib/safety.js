import { solve, fmt } from '../public/engine.js';

// ---- Validate the AI's output before a student ever sees it.
export function safeAiHint(text, item, answerStr) {
  if (!text) return null;
  let t = text.replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim();
  const words = t.split(' ').length;
  if (words < 4 || words > 45) return null;
  const correct = fmt(solve(item)).replace('−', '-');
  const nums = (t.replace(/[−–]/g, '-').match(/-?\d+(?:[./]\d+)?/g) || []);
  // Never reveal the answer.
  if (nums.some((n) => n === correct || n.replace(/^-/, '') === correct.replace(/^-/, ''))) return null;
  if (/x\s*=\s*-?\d/.test(t.replace(/[−–]/g, '-'))) return null;
  // Also block the answer written as a word ("seven").
  const WORDS = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'];
  const c = solve(item);
  if (c.d === 1 && Math.abs(c.n) <= 20 && new RegExp(`\\b${WORDS[Math.abs(c.n)]}\\b`, 'i').test(t)) return null;
  // Only allow numbers that appear in the problem or in the student's answer (stops made-up math).
  const allowed = new Set([item.a, item.b, Math.abs(item.a), Math.abs(item.b), -item.a, -item.b]
    .map(String).concat([answerStr.replace(/[−–]/g, '-'), answerStr.replace(/[−–-]/g, '')]));
  if (nums.some((n) => !allowed.has(n) && !allowed.has(n.replace(/^-/, '')))) return null;
  return t;
}

