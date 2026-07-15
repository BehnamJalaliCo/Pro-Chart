import test from 'node:test';
import assert from 'node:assert/strict';
import { DrawingHistory } from '../../frontend/prochart/src/bazaarnama/drawing_history.js';

const command = (id) => ({ id, type: 'hline', p: 1 + id / 1000, style: { width: 2 } });

test('MOT-006: 50 undo and redo operations preserve exact drawing state', () => {
  const history = new DrawingHistory(100);
  let drawings = [];
  for (let id = 1; id <= 60; id += 1) {
    history.record(drawings);
    drawings = [...drawings, command(id)];
  }
  const expected = structuredClone(drawings);

  for (let i = 0; i < 50; i += 1) drawings = history.undo(drawings);
  assert.equal(drawings.length, 10);
  assert.deepEqual(drawings, expected.slice(0, 10));
  assert.equal(history.canRedo(), true);

  for (let i = 0; i < 50; i += 1) drawings = history.redo(drawings);
  assert.deepEqual(drawings, expected);
  assert.equal(history.canRedo(), false);
});

test('MOT-006: snapshots are deep copies and a new command invalidates redo', () => {
  const history = new DrawingHistory(100);
  let drawings = [command(1)];
  history.record(drawings);
  drawings[0].style.width = 9;
  drawings = history.undo(drawings);
  assert.equal(drawings[0].style.width, 2);

  drawings = [...drawings, command(2)];
  history.record(drawings);
  assert.equal(history.canRedo(), false);
});

test('MOT-006: history is bounded to 100 snapshots without corrupting order', () => {
  const history = new DrawingHistory(100);
  let drawings = [];
  for (let id = 1; id <= 140; id += 1) {
    history.record(drawings);
    drawings = [...drawings, command(id)];
  }
  assert.equal(history.past.length, 100);
  for (let i = 0; i < 100; i += 1) drawings = history.undo(drawings);
  assert.equal(drawings.length, 40);
  assert.deepEqual(drawings.map(({ id }) => id), Array.from({ length: 40 }, (_, index) => index + 1));
  assert.equal(history.undo(drawings), null);
});
