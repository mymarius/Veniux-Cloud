import test from 'node:test';
import assert from 'node:assert/strict';
import {compareVersions,evaluateCompatibility} from './versionCompat.mjs';

test('sürümler sayısal karşılaştırılır',()=>{
  assert.equal(compareVersions('2.4.9','2.4.10'),-1);
  assert.equal(compareVersions('2.5.0','2.4.99'),1);
  assert.equal(compareVersions('2.4.1','2.4.1'),0);
  assert.equal(compareVersions('bilinmiyor','2.4.1'),null);
});

test('eski program uyarı alır',()=>{
  assert.equal(evaluateCompatibility({clientVersion:'2.4.1',minServer:'2.4.0',server:{version:'2.4.5',minClient:'2.4.3'}}).kind,'client-outdated');
});

test('eski sunucu uyarı üretir',()=>{
  assert.equal(evaluateCompatibility({clientVersion:'2.4.9',minServer:'2.4.8',server:{version:'2.4.5',minClient:'2.4.3'}}).kind,'server-outdated');
});

test('uyumlu veya bilinmeyen durumda uyarı yok',()=>{
  assert.equal(evaluateCompatibility({clientVersion:'2.4.9',minServer:'2.4.8',server:{version:'2.4.9',minClient:'2.4.3'}}),null);
  assert.equal(evaluateCompatibility({clientVersion:'2.4.9',minServer:'2.4.8',server:null}),null);
  assert.equal(evaluateCompatibility({clientVersion:'2.4.9',minServer:'2.4.8',server:{}}),null);
});
