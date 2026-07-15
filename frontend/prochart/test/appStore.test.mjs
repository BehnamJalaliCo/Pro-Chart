import test from 'node:test';
import assert from 'node:assert/strict';

function element() {
  const classes = new Set();
  return {
    lang: '',
    dir: '',
    classList: {
      add: (...values) => values.forEach((value) => classes.add(value)),
      remove: (...values) => values.forEach((value) => classes.delete(value)),
      contains: (value) => classes.has(value),
    },
  };
}

test('PC-009 keeps the document fa/rtl and scopes a persisted English selection to the app island', async () => {
  const values = new Map([
    ['pc_app_v1', JSON.stringify({ lang: 'en', theme: 'light' })],
  ]);
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };

  const html = element();
  const body = element();
  const root = element();
  globalThis.document = {
    documentElement: html,
    body,
    getElementById: (id) => (id === 'root' ? root : null),
  };

  const { useApp } = await import(`../src/appStore.js?pc009=${Date.now()}`);

  assert.equal(useApp.getState().lang, 'en');
  assert.deepEqual({ lang: html.lang, dir: html.dir }, { lang: 'fa', dir: 'rtl' });
  assert.deepEqual({ lang: body.lang, dir: body.dir }, { lang: 'en', dir: 'ltr' });
  assert.deepEqual({ lang: root.lang, dir: root.dir }, { lang: 'en', dir: 'ltr' });

  useApp.getState().setLang('fa');
  assert.deepEqual({ lang: html.lang, dir: html.dir }, { lang: 'fa', dir: 'rtl' });
  assert.deepEqual({ lang: body.lang, dir: body.dir }, { lang: 'fa', dir: 'rtl' });
  assert.deepEqual({ lang: root.lang, dir: root.dir }, { lang: 'fa', dir: 'rtl' });

  useApp.getState().setLang('unsupported');
  assert.equal(useApp.getState().lang, 'fa');
  assert.equal(JSON.parse(values.get('pc_app_v1')).lang, 'fa');
});
