import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playWithReveal } from '../src/lib/synchronizedPlayback.js';

test('text waits for actual playback, and is revealed once', async () => {
  const audio={play:()=>Promise.resolve()};let shown=0;
  const done=playWithReveal(audio,()=>shown++);
  await Promise.resolve();assert.equal(shown,0);
  audio.onplaying();audio.onplaying();assert.equal(shown,1);
  audio.onended();await done;assert.equal(audio.onplaying,null);
});
test('blocked playback rejects without claiming audio started', async () => {
  const audio={play:()=>Promise.reject(new Error('blocked'))};let shown=false;
  await assert.rejects(playWithReveal(audio,()=>shown=true),/blocked/);
  assert.equal(shown,false);
});
test('cancellation before playback does not reveal stale text', async () => {
  const audio={play:()=>Promise.resolve()};let shown=false;
  const done=playWithReveal(audio,()=>shown=true);audio.onended();await done;
  assert.equal(shown,false);
});
