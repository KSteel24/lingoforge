import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Lib = require('../src/js/content-lib.js');
const Norm = require('../src/js/norm.js');
const ENABLED = Lib.ENABLED_LANGS;
const content = Object.fromEntries(ENABLED.map((l) => [l, require(`../src/js/content-${l}.js`)]));

for (const lang of ENABLED) {
  test(`Inhalt ${lang}: Validierung ohne Fehler`, () => {
    assert.deepEqual(Lib.validate(content[lang]), []);
  });

  test(`Inhalt ${lang}: 6 Einheiten, je ca. 12 Items, Pflichtfelder`, () => {
    const c = content[lang];
    assert.equal(c.units.length, 6);
    for (const u of c.units) assert.ok(u.items.length >= 11 && u.items.length <= 13, `Einheit ${u.id}: ${u.items.length}`);
    for (const it of c.items) {
      for (const f of ['id', 'unit', 'kind', 'tgt', 'de', 'alt', 'tokens', 'distractors', 'strict', 'audio']) {
        assert.ok(f in it, `${it.id}: ${f}`);
      }
    }
  });

  test(`Inhalt ${lang}: tokens.join(' ') passt zur Normalform des Zielsatzes`, () => {
    for (const it of content[lang].items) {
      assert.equal(Norm.canon(it.tokens.join(' ')), Norm.canon(it.tgt), it.id);
    }
  });

  test(`Inhalt ${lang}: Cloze-Antwort in Optionen, Lücke ergibt Zielsatz`, () => {
    let n = 0;
    for (const it of content[lang].items) {
      if (!it.cloze) continue;
      n++;
      assert.ok(it.cloze.options.includes(it.cloze.answer), it.id);
      assert.equal(Norm.canon(it.cloze.text.replace('___', it.cloze.answer)), Norm.canon(it.tgt), it.id);
      assert.ok(!it.distractors.slice(0, 2).includes(it.cloze.answer), it.id);
    }
    assert.ok(n >= 40, `zu wenige Cloze-Items: ${n}`);
  });

  test(`Inhalt ${lang}: Typing akzeptiert Zielsatz und alt, lehnt Fremdes ab`, () => {
    for (const it of content[lang].items) {
      assert.equal(Norm.check(it.tgt, it), 'exact', it.id);
      for (const a of it.alt) assert.equal(Norm.check(a, it), 'exact', it.id);
      assert.equal(Norm.check('qwertzuiop', it), 'wrong', it.id);
    }
  });
}

test('Inhalt: IDs sind über alle aktiven Sprachen eindeutig', () => {
  const ids = Object.values(content).flatMap((c) => c.items.map((i) => i.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length >= 60 * ENABLED.length);
});

test('Inhalt: strict-Item (es) vorhanden und wirksam', () => {
  const es = content.es.items.find((i) => i.strict);
  assert.ok(es);
  assert.equal(Norm.check('el', es), 'wrong');
});

test('Validator erkennt kaputte Daten', () => {
  const bad = Lib.build('en', [{ title: 'x', rows: [['Good morning', 'Guten Morgen', 'night evening', 1], ['Good morning', 'x', 'a b', 1]] }]);
  bad.items[0].tokens = ['Good', 'evening'];
  bad.items[0].cloze.options = ['night', 'evening', 'day'];
  const errs = Lib.validate(bad).join('\n');
  assert.match(errs, /tokens passen nicht/);
  assert.match(errs, /Cloze-Antwort fehlt/);
  assert.match(errs, /erwartet 6 Einheiten/);
});
