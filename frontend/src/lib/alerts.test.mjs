import test from 'node:test';
import assert from 'node:assert/strict';
import { isOpenAlert, openAlerts, unseenAlerts } from './alerts.mjs';

test('sunucunun status alanı belirleyicidir: yalnız unread ve active açıktır', () => {
  assert.equal(isOpenAlert({ status: 'unread' }), true);
  assert.equal(isOpenAlert({ status: 'active' }), true);
  assert.equal(isOpenAlert({ status: 'read' }), false);
  assert.equal(isOpenAlert({ status: 'resolved' }), false);
});

test('status yoksa eski alanlar kullanılır; bozuk girdi kapalı sayılır', () => {
  assert.equal(isOpenAlert({ is_read: false }), true);
  assert.equal(isOpenAlert({ is_read: true }), false);
  assert.equal(isOpenAlert({ read: true }), false);
  assert.equal(isOpenAlert(null), false);
  assert.equal(isOpenAlert('x'), false);
});

test('status varken is_read yok sayılır (okunan uyarı rozeti söndürür)', () => {
  assert.equal(isOpenAlert({ status: 'read', is_read: false }), false);
});

test('openAlerts dizi olmayan girdide boş döner', () => {
  assert.deepEqual(openAlerts(undefined), []);
  assert.equal(openAlerts([{ status: 'unread' }, { status: 'read' }]).length, 1);
});

test('unseenAlerts yalnız görülmemiş açık uyarıları döner', () => {
  const list = [{ id: 1, status: 'unread' }, { id: 2, status: 'unread' }, { id: 3, status: 'read' }, { status: 'unread' }];
  assert.deepEqual(unseenAlerts(list, ['1']).map(a => a.id), [2]);
  assert.deepEqual(unseenAlerts(list, new Set()).map(a => a.id), [1, 2]);
});
