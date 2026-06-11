import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { parseGitHubRemote } from '../src/services/githubRemote';

test('parseGitHubRemote handles the SSH form', () => {
  assert.deepEqual(parseGitHubRemote('git@github.com:owner/repo.git'), { repoPath: 'owner/repo.git' });
});

test('parseGitHubRemote handles the HTTPS form with and without a username', () => {
  assert.deepEqual(parseGitHubRemote('https://github.com/owner/repo.git'), { repoPath: 'owner/repo.git' });
  assert.deepEqual(parseGitHubRemote('https://octocat@github.com/owner/repo.git'), {
    repoPath: 'owner/repo.git',
  });
});

test('parseGitHubRemote handles the ssh:// protocol form', () => {
  assert.deepEqual(parseGitHubRemote('ssh://git@github.com/owner/repo.git'), {
    repoPath: 'owner/repo.git',
  });
});

test('parseGitHubRemote rejects non-github remotes', () => {
  assert.equal(parseGitHubRemote('git@gitlab.com:owner/repo.git'), undefined);
  assert.equal(parseGitHubRemote('https://bitbucket.org/owner/repo.git'), undefined);
  // An SSH host alias is not assumed to be github (SSHConfigService owns that).
  assert.equal(parseGitHubRemote('git@github-work:owner/repo.git'), undefined);
});
