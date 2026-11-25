import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const N = require('../src/js/norm.js');

test('canon: NFC/NFD gleich, Groß/Klein, Satzzeichen ¿¡ und Typografie', () => {
  assert.equal(N.canon('¿Cómo estás?'), 'cómo estás');
  assert.equal(N.canon('Cómo'.normalize('NFD')), N.canon('Cómo'.normalize('NFC')));
  assert.equal(N.canon('¡Hola!  '), 'hola');
  assert.equal(N.canon('I’m fine'), "i'm fine");
  assert.equal(N.canon('Comment allez-vous ?'), 'comment allez vous');
  assert.equal(N.canon('sœur'), 'soeur');
});

test('fold: Akzente weg, ñ bleibt', () => {
  assert.equal(N.fold('canción'), 'cancion');
  assert.equal(N.fold('año'), 'año');
  assert.equal(N.fold('où à é ç'), 'ou a e c');
});

test('levenshtein', () => {
  assert.equal(N.lev('kitten', 'sitting'), 3);
  assert.equal(N.lev('', 'abc'), 3);
  assert.equal(N.lev('abc', 'abc'), 0);
  assert.equal(N.lev('flaw', 'lawn'), 2);
});

test('Typo-Toleranz nach Länge: <=3 -> 0, <=7 -> 1, sonst 2', () => {
  assert.deepEqual([1, 3, 4, 7, 8, 30].map(N.maxTypos), [0, 0, 1, 1, 2, 2]);
});

test('check: exact, accentOnly, typo, wrong', () => {
  const it = { tgt: '¿Cómo estás?', alt: ['¿Qué tal?'], strict: false };
  assert.equal(N.check('como estás', it), 'accentOnly');
  assert.equal(N.check('¿Cómo estás?', it), 'exact');
  assert.equal(N.check('cómo estás', it), 'exact');
  assert.equal(N.check('Como estas', it), 'accentOnly');
  assert.equal(N.check('cómo estass', it), 'typo');
  assert.equal(N.check('Como estassss', it), 'wrong');
  assert.equal(N.check('qué tal', it), 'exact');
  assert.equal(N.check('que tal', it), 'accentOnly');
  assert.equal(N.check('', it), 'wrong');
  assert.equal(N.check('adiós', it), 'wrong');
});

test('check: kurze Wörter tolerieren keine Tippfehler, mittlere einen', () => {
  assert.equal(N.check('cot', { tgt: 'cat' }), 'wrong');
  assert.equal(N.check('hose', { tgt: 'house' }), 'typo');
  assert.equal(N.check('hoose', { tgt: 'house' }), 'typo');
  assert.equal(N.check('hxxse', { tgt: 'house' }), 'wrong');
  assert.equal(N.check('I am hungri', { tgt: 'I am hungry' }), 'typo');
  assert.equal(N.check('I am hungrry', { tgt: 'I am hungry' }), 'typo');
});

test('check: ñ ist kein Akzent', () => {
  assert.equal(N.check('ano', { tgt: 'año' }), 'wrong');
  assert.equal(N.check('año', { tgt: 'año' }), 'exact');
  assert.equal(N.check('manana', { tgt: 'mañana' }), 'typo');
});

test('check: strict = keine Tippfehler, keine Akzentabweichung', () => {
  assert.equal(N.check('el', { tgt: 'él', strict: true }), 'wrong');
  assert.equal(N.check('él', { tgt: 'él', strict: true }), 'exact');
  assert.equal(N.check('hose', { tgt: 'house', strict: true }), 'wrong');
  assert.equal(N.check('ou', { tgt: 'où', strict: true }), 'wrong');
  assert.equal(N.check('Où', { tgt: 'où', strict: true }), 'exact');
});

test('check: Apostroph und œ-Ligatur', () => {
  assert.equal(N.check('Je m’appelle Léa', { tgt: "Je m'appelle Léa" }), 'exact');
  assert.equal(N.check("je m'appelle lea", { tgt: "Je m'appelle Léa" }), 'accentOnly');
  assert.equal(N.check('Elle est ma soeur', { tgt: 'Elle est ma sœur' }), 'exact');
});

test('check: alt-Lösungen mit eigener Toleranz', () => {
  const it = { tgt: 'Mucho gusto', alt: ['Encantado', 'Encantada'] };
  assert.equal(N.check('encantada', it), 'exact');
  assert.equal(N.check('encantadа'.replace('а', 'a'), it), 'exact');
  assert.equal(N.check('encantdo', it), 'typo');
});

test('tokenize und hintMask', () => {
  assert.deepEqual(N.tokenize('¿Dónde está el baño?'), ['Dónde', 'está', 'el', 'baño']);
  assert.deepEqual(N.tokenize("Aujourd'hui, c'est lundi"), ["Aujourd'hui", "c'est", 'lundi']);
  assert.equal(N.hintMask('Je viens'), 'J_ v____');
  assert.equal(N.hintMask("c'est"), "c'___");
});
