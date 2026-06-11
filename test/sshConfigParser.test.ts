import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { parseHostBlocks } from '../src/services/sshConfigParser';

const lines = (s: string) => s.split('\n');

test('parseHostBlocks parses a single GitFlip-managed block', () => {
  const blocks = parseHostBlocks(
    lines(['# GitFlip: Work', 'Host github-work', '  HostName github.com', '  IdentityFile ~/.ssh/work', ''].join('\n'))
  );
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].host, 'github-work');
  assert.equal(blocks[0].markedByGitFlip, true);
  assert.equal(blocks[0].identityFile, '~/.ssh/work');
  assert.equal(blocks[0].markerLine, 0);
  assert.equal(blocks[0].startLine, 1);
});

test('parseHostBlocks distinguishes GitFlip blocks from hand-written ones', () => {
  const blocks = parseHostBlocks(
    lines(
      [
        'Host personal',
        '  HostName github.com',
        '',
        '# GitFlip: Work',
        'Host github-work',
        '  IdentityFile ~/.ssh/work',
      ].join('\n')
    )
  );
  assert.equal(blocks.length, 2);
  const personal = blocks.find((b) => b.host === 'personal')!;
  const work = blocks.find((b) => b.host === 'github-work')!;
  assert.equal(personal.markedByGitFlip, false);
  assert.equal(work.markedByGitFlip, true);
});

test('parseHostBlocks computes block boundaries so removal stays contained', () => {
  const text = ['Host a', '  HostName a.com', 'Host b', '  HostName b.com'].join('\n');
  const blocks = parseHostBlocks(lines(text));
  assert.equal(blocks.length, 2);
  // Block "a" ends exactly where block "b" begins — no overlap.
  assert.equal(blocks[0].endLine, blocks[1].startLine);
});

test('parseHostBlocks takes the first token as the alias and ignores wildcards form', () => {
  const blocks = parseHostBlocks(lines('Host github-work github.com'));
  assert.equal(blocks[0].host, 'github-work');
});

test('parseHostBlocks returns nothing for an empty file', () => {
  assert.deepEqual(parseHostBlocks([]), []);
});
