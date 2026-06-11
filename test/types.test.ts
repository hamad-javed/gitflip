import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  isSafeAvatarUrl,
  resolveAuthMethod,
  validateProfileInput,
  Profile,
  ProfileInput,
} from '../src/types';

function baseInput(overrides: Partial<ProfileInput> = {}): ProfileInput {
  return {
    name: 'Work',
    gitUserName: 'octocat',
    gitEmail: 'octo@example.com',
    authMethod: 'none',
    ...overrides,
  };
}

test('validateProfileInput accepts a minimal valid profile', () => {
  assert.deepEqual(validateProfileInput(baseInput()), []);
});

test('validateProfileInput requires name, user, and email', () => {
  const errors = validateProfileInput(baseInput({ name: ' ', gitUserName: '', gitEmail: '' }));
  assert.equal(errors.length, 3);
});

test('validateProfileInput rejects a malformed email', () => {
  const errors = validateProfileInput(baseInput({ gitEmail: 'not-an-email' }));
  assert.ok(errors.some((e) => e.toLowerCase().includes('email')));
});

test('validateProfileInput requires SSH key and host for ssh method', () => {
  const errors = validateProfileInput(baseInput({ authMethod: 'ssh' }));
  assert.ok(errors.some((e) => e.includes('SSH key')));
  assert.ok(errors.some((e) => e.includes('SSH host')));
});

test('validateProfileInput rejects an SSH host alias with bad characters', () => {
  const errors = validateProfileInput(
    baseInput({ authMethod: 'ssh', sshKeyPath: '~/.ssh/id', sshHost: 'bad alias!' })
  );
  assert.ok(errors.some((e) => e.toLowerCase().includes('host alias')));
});

test('validateProfileInput accepts a well-formed ssh profile', () => {
  const errors = validateProfileInput(
    baseInput({ authMethod: 'ssh', sshKeyPath: '~/.ssh/id_ed25519', sshHost: 'github-work' })
  );
  assert.deepEqual(errors, []);
});

test('validateProfileInput rejects an unsafe avatar url', () => {
  const errors = validateProfileInput(baseInput({ avatarUrl: 'http://insecure/avatar.png' }));
  assert.ok(errors.some((e) => e.toLowerCase().includes('avatar')));
});

test('isSafeAvatarUrl allows https and image data URIs only', () => {
  assert.equal(isSafeAvatarUrl('https://example.com/a.png'), true);
  assert.equal(isSafeAvatarUrl('data:image/png;base64,AAAA'), true);
  assert.equal(isSafeAvatarUrl('http://example.com/a.png'), false);
  assert.equal(isSafeAvatarUrl('javascript:alert(1)'), false);
  assert.equal(isSafeAvatarUrl('file:///etc/passwd'), false);
  assert.equal(isSafeAvatarUrl('data:text/html;base64,AAAA'), false);
});

test('resolveAuthMethod honours an explicit method', () => {
  const p: Profile = { id: '1', name: 'x', gitUserName: 'u', gitEmail: 'e@e.com', authMethod: 'https' };
  assert.equal(resolveAuthMethod(p), 'https');
});

test('resolveAuthMethod infers ssh from key/host for legacy profiles', () => {
  const p: Profile = { id: '1', name: 'x', gitUserName: 'u', gitEmail: 'e@e.com', sshHost: 'gh' };
  assert.equal(resolveAuthMethod(p), 'ssh');
});

test('resolveAuthMethod infers https from useToken, else none', () => {
  const token: Profile = { id: '1', name: 'x', gitUserName: 'u', gitEmail: 'e@e.com', useToken: true };
  const none: Profile = { id: '1', name: 'x', gitUserName: 'u', gitEmail: 'e@e.com' };
  assert.equal(resolveAuthMethod(token), 'https');
  assert.equal(resolveAuthMethod(none), 'none');
});
