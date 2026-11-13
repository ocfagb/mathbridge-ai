// Team-created equation bank. Every item is checked at startup by `npm test`
// (answer is a whole number, and each known mistake gives a different wrong answer).
// Teachers: edit these freely, then run `npm test`.

export const PRACTICE = [
  { id: 'p1', form: 'add', a: 7, b: 15 },    // x = 8
  { id: 'p2', form: 'sub', a: 4, b: 9 },     // x = 13
  { id: 'p3', form: 'mul', a: 3, b: 21 },    // x = 7
  { id: 'p4', form: 'div', a: 5, b: 6 },     // x = 30
  { id: 'p5', form: 'add', a: 12, b: 20 },   // x = 8
  { id: 'p6', form: 'sub', a: 9, b: 14 },    // x = 23
  { id: 'p7', form: 'mul', a: 6, b: 48 },    // x = 8
  { id: 'p8', form: 'div', a: 4, b: 9 },     // x = 36
  { id: 'p9', form: 'add', a: 8, b: 3 },     // x = −5
  { id: 'p10', form: 'sub', a: 6, b: -2 },   // x = 4
  { id: 'p11', form: 'mul', a: -4, b: 28 },  // x = −7
  { id: 'p12', form: 'div', a: -3, b: 5 },   // x = −15
];

// Quizzes use whole, non-negative answers (grade 6 friendly; negatives start in grade 7).
// Pre- and post-quiz use matching forms and difficulty so scores can be compared.
export const PRE_QUIZ = [
  { id: 'q1', form: 'sub', a: 5, b: 11 },    // x = 16
  { id: 'q2', form: 'mul', a: 5, b: 35 },    // x = 7
  { id: 'q3', form: 'div', a: 3, b: 4 },     // x = 12
];

export const POST_QUIZ = [
  { id: 'r1', form: 'sub', a: 8, b: 9 },     // x = 17
  { id: 'r2', form: 'mul', a: 7, b: 42 },    // x = 6
  { id: 'r3', form: 'div', a: 2, b: 7 },     // x = 14
];
