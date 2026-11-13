// MathBridge AI — tiny web server (no dependencies, Node 20+).
// Serves the app from /public and, ONLY if enabled, an AI rewording endpoint.
//
// Privacy: no accounts, no cookies, no database, no request logging.
// The AI endpoint accepts only numbers (equation + typed answer), never free text.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { diagnose, showEquation, FORMS } from './public/engine.js';
import { safeAiHint } from './lib/safety.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const PORT = Number(process.env.PORT) || 3000;
const API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
// AI is OFF unless a teacher/team member explicitly turns it on. See README "About the AI".
const AI_ON = process.env.AI_HINTS === 'on' && API_KEY.length > 0;
const DEBUG = process.env.DEBUG === '1'; // logs only status codes, never student answers

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.ico': 'image/x-icon', '.png': 'image/png',
};
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:",
};

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...SECURITY_HEADERS });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

// ---- Simple in-memory rate limit for the AI route (protects the API budget). Nothing is stored to disk.
const hits = new Map();
function tooMany(ip) {
  const now = Date.now(), win = 60_000, max = 10;
  const arr = (hits.get(ip) || []).filter((t) => now - t < win);
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}

async function aiHint(item, answerStr, ruleHint) {
  const F = FORMS[item.form];
  const prompt = [
    'You help a middle school student (age 11-14) learn one-step equations.',
    `Equation: ${showEquation(item)}`,
    `The student answered: x = ${answerStr} (this is WRONG).`,
    `Verified next step (from our app, trust this): ${F.undo(item.a)}.`,
    `Our diagnosis of the mistake: ${ruleHint}`,
    '',
    'Write ONE short, kind hint (max 30 words, simple words) that helps them see their mistake.',
    'Rules: Do NOT give the answer or say what x equals. Do NOT do new arithmetic.',
    'Only use numbers that appear in the equation or in the student answer.',
    'End with a question that makes them try again.',
  ].join('\n');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  const base = 'https://generativelanguage.googleapis.com/v1beta';
  const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY };
  try {
    // Current Gemini API ("Interactions"). See docs/RESEARCH.md for sources.
    let r = await fetch(`${base}/interactions`, {
      method: 'POST', signal: ctrl.signal,
      headers: { ...headers, 'Api-Revision': '2026-05-20' },
      body: JSON.stringify({ model: MODEL, input: prompt, store: false, generation_config: { max_output_tokens: 200 } }),
    });
    // Fallback: older generateContent endpoint, if this key/model still uses it.
    if (r.status === 404 || r.status === 400) {
      r = await fetch(`${base}/models/${encodeURIComponent(MODEL)}:generateContent`, {
        method: 'POST', signal: ctrl.signal, headers,
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 200 } }),
      });
    }
    if (!r.ok) { if (DEBUG) console.warn('Gemini HTTP', r.status, (await r.text()).slice(0, 300)); return null; }
    const text = extractText(await r.json());
    const safe = safeAiHint(text, item, answerStr);
    if (DEBUG) console.log('AI hint', safe ? 'accepted' : 'rejected by filter');
    return safe;
  } catch (e) {
    if (DEBUG) console.warn('Gemini error', e.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Pull the visible text out of either API response shape (skips "thought" parts).
function extractText(data) {
  if (typeof data?.output_text === 'string') return data.output_text;
  const parts = data?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) return parts.filter((p) => !p.thought).map((p) => p.text || '').join('');
  const out = [];
  (function walk(v, key) {
    if (!v || key === 'thought' || key === 'thoughts' || v.type === 'thought') return;
    if (typeof v === 'string') { if (key === 'text') out.push(v); return; }
    if (Array.isArray(v)) return v.forEach((x) => walk(x, key));
    if (typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
  })(data?.outputs ?? data?.steps ?? data?.output ?? data, '');
  return out.join(' ');
}

async function readJson(req, limit = 1000) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > limit) throw new Error('too large');
  }
  return JSON.parse(body || '{}');
}

const intOk = (v) => Number.isInteger(v) && Math.abs(v) <= 1000;

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname === '/api/config') return send(res, 200, { ai: AI_ON });
    if (url.pathname === '/healthz') return send(res, 200, { ok: true });

    if (url.pathname === '/api/hint' && req.method === 'POST') {
      if (!AI_ON) return send(res, 200, { source: 'rules' });
      if (tooMany(req.socket.remoteAddress || '?')) return send(res, 200, { source: 'rules' });
      const { form, a, b, answer } = await readJson(req);
      // Only numbers are accepted — no free text from students ever reaches the AI.
      if (!FORMS[form] || !intOk(a) || !intOk(b) || typeof answer !== 'string' || !/^[-−]?\d{1,4}([./]\d{1,4})?$/.test(answer.trim()))
        return send(res, 400, { error: 'bad input' });
      const item = { form, a, b };
      const d = diagnose(item, answer.trim());
      if (d.correct || d.kind === 'unreadable') return send(res, 200, { source: 'rules' });
      const hint = await aiHint(item, answer.trim(), d.hint);
      return send(res, 200, hint ? { source: 'ai', hint } : { source: 'rules' });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method' });

    // Static files
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    if (path === '/' || path === '') path = '/index.html';
    const file = join(ROOT, path);
    if (!file.startsWith(ROOT)) return send(res, 403, 'forbidden', 'text/plain');
    try {
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', ...SECURITY_HEADERS });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch {
      send(res, 404, 'Not found', 'text/plain');
    }
  } catch {
    send(res, 500, { error: 'server error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`MathBridge AI running on port ${PORT} — AI hints ${AI_ON ? `ON (${MODEL})` : 'OFF (rule-based hints)'}`);
});

