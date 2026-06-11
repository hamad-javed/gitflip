import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Profile } from '../types';
import { GitUtil } from './GitUtil';
import { HostBlock, MARKER_PREFIX, parseHostBlocks } from './sshConfigParser';

const SSH_CONFIG_PATH = path.join(os.homedir(), '.ssh', 'config');

interface SSHHostEntry {
  marker: string;
  host: string;
  hostName?: string;
  user?: string;
  identityFile?: string;
}

export class SSHConfigService {
  /** Add a host block for an SSH profile if the alias is not already present. */
  addHostEntry(profile: Profile): void {
    if (!profile.sshKeyPath || !profile.sshHost) {
      return;
    }

    const blocks = this.parseHostBlocks();
    if (blocks.some(b => b.host === profile.sshHost)) {
      return; // Host already exists (from any source) — don't duplicate.
    }

    this.ensureSSHConfigExists();
    let existing = fs.readFileSync(SSH_CONFIG_PATH, 'utf-8');
    if (existing.length > 0 && !existing.endsWith('\n')) {
      existing += '\n';
    }

    const entry = [
      '',
      `${MARKER_PREFIX} ${profile.name}`,
      `Host ${profile.sshHost}`,
      `  HostName github.com`,
      `  User git`,
      `  IdentityFile ${profile.sshKeyPath}`,
      `  IdentitiesOnly yes`,
      '',
    ].join('\n');

    this.writeConfig(existing + entry);
  }

  /**
   * Remove a GitFlip-managed host block by alias. Only removes blocks that
   * GitFlip created (marked with the GitFlip comment); never touches blocks
   * the user wrote by hand.
   */
  removeHostEntry(hostAlias: string): void {
    if (!fs.existsSync(SSH_CONFIG_PATH)) {
      return;
    }

    const content = fs.readFileSync(SSH_CONFIG_PATH, 'utf-8');
    const lines = content.split('\n');
    const blocks = this.parseHostBlocks(lines);

    const target = blocks.find(b => b.host === hostAlias && b.markedByGitFlip);
    if (!target) {
      return; // Not present, or not GitFlip-managed — leave the file alone.
    }

    // Drop the block plus its marker line.
    const removeFrom = target.markerLine ?? target.startLine;
    const kept: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (i >= removeFrom && i < target.endLine) {
        continue;
      }
      kept.push(lines[i]);
    }

    // Collapse the run of blank lines the removal may have left behind.
    const cleaned = kept.join('\n').replace(/\n{3,}/g, '\n\n');
    this.writeConfig(cleaned);
  }

  /**
   * Rewrite the repo's `origin` remote to use the profile's SSH host alias.
   * Only rewrites URLs that already point at GitHub (direct or via an alias
   * whose HostName resolves to github.com). Returns true if changed.
   */
  updateRemoteUrl(profile: Profile, repoRoot: string): boolean {
    if (!profile.sshHost || !repoRoot) {
      return false;
    }

    const currentUrl = GitUtil.tryRun(['remote', 'get-url', 'origin'], repoRoot);
    if (!currentUrl) {
      return false;
    }

    const repoPath = this.extractGitHubRepoPath(currentUrl);
    if (!repoPath) {
      return false; // Not a GitHub remote — don't touch it.
    }

    const newUrl = `git@${profile.sshHost}:${repoPath}`;
    if (newUrl === currentUrl) {
      return false;
    }

    GitUtil.run(['remote', 'set-url', 'origin', newUrl], repoRoot);
    return true;
  }

  /**
   * Extract the `owner/repo(.git)` path from a remote URL if it points at
   * github.com — directly, via HTTPS, or via an SSH host alias whose
   * HostName is github.com. Returns undefined otherwise.
   */
  private extractGitHubRepoPath(url: string): string | undefined {
    // git@github.com:owner/repo.git
    const directSsh = url.match(/^git@github\.com:(.+)$/);
    if (directSsh) {
      return directSsh[1];
    }

    // ssh://git@github.com/owner/repo.git
    const sshProto = url.match(/^ssh:\/\/git@github\.com\/(.+)$/);
    if (sshProto) {
      return sshProto[1];
    }

    // https://[user@]github.com/owner/repo(.git)
    const https = url.match(/^https:\/\/(?:[^@/]+@)?github\.com\/(.+)$/);
    if (https) {
      return https[1];
    }

    // git@<alias>:owner/repo.git — only if the alias resolves to github.com.
    const aliasSsh = url.match(/^git@([^:]+):(.+)$/);
    if (aliasSsh) {
      const alias = aliasSsh[1];
      const repoPath = aliasSsh[2];
      const block = this.parseHostBlocks().find(b => b.host === alias);
      if (block && this.hostNameFor(block) === 'github.com') {
        return repoPath;
      }
    }

    return undefined;
  }

  /** Read the HostName directive of a parsed block. */
  private hostNameFor(block: HostBlock): string | undefined {
    if (!fs.existsSync(SSH_CONFIG_PATH)) {
      return undefined;
    }
    const lines = fs.readFileSync(SSH_CONFIG_PATH, 'utf-8').split('\n');
    for (let i = block.startLine + 1; i < block.endLine; i++) {
      const m = lines[i].trim().match(/^HostName\s+(.+)$/i);
      if (m) {
        return m[1].trim();
      }
    }
    return undefined;
  }

  /** Return all GitFlip-managed host entries with their key paths. */
  getExistingEntries(): SSHHostEntry[] {
    const lines = this.readConfigLines();
    const entries: SSHHostEntry[] = [];

    for (const block of this.parseHostBlocks(lines)) {
      if (!block.markedByGitFlip) {
        continue;
      }
      const entry: SSHHostEntry = { marker: '', host: block.host, identityFile: block.identityFile };
      if (block.markerLine !== undefined) {
        entry.marker = lines[block.markerLine].substring(MARKER_PREFIX.length).trim();
      }
      entries.push(entry);
    }

    return entries;
  }

  /** Discover candidate SSH private keys in ~/.ssh. */
  discoverSSHKeys(): { name: string; path: string; hasPublicKey: boolean }[] {
    const sshDir = path.join(os.homedir(), '.ssh');
    if (!fs.existsSync(sshDir)) {
      return [];
    }

    let files: string[];
    try {
      files = fs.readdirSync(sshDir);
    } catch {
      return [];
    }

    const publicKeyFiles = new Set(files.filter(f => f.endsWith('.pub')).map(f => f.slice(0, -4)));
    const skip = new Set(['config', 'known_hosts', 'known_hosts.old', 'authorized_keys', 'environment']);
    const keys: { name: string; path: string; hasPublicKey: boolean }[] = [];

    for (const file of files) {
      if (file.startsWith('.') || file.endsWith('.pub') || skip.has(file)) {
        continue;
      }

      const fullPath = path.join(sshDir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) {
          continue;
        }

        // Private keys begin with a PEM/OpenSSH header.
        const fd = fs.openSync(fullPath, 'r');
        const head = Buffer.alloc(32);
        fs.readSync(fd, head, 0, 32, 0);
        fs.closeSync(fd);
        if (!head.toString('utf-8').startsWith('-----BEGIN')) {
          continue;
        }

        keys.push({ name: file, path: fullPath, hasPublicKey: publicKeyFiles.has(file) });
      } catch {
        // Skip unreadable files.
      }
    }

    return keys;
  }

  /** Return every Host alias in the config (deduped, wildcards excluded). */
  getAllSSHConfigHosts(): { host: string; identityFile?: string }[] {
    const seen = new Set<string>();
    const hosts: { host: string; identityFile?: string }[] = [];

    for (const block of this.parseHostBlocks()) {
      if (block.host.includes('*') || seen.has(block.host)) {
        continue;
      }
      seen.add(block.host);
      hosts.push({ host: block.host, identityFile: block.identityFile });
    }

    return hosts;
  }

  /** Parse the SSH config file (or supplied lines) into Host blocks. */
  private parseHostBlocks(lines: string[] = this.readConfigLines()): HostBlock[] {
    return parseHostBlocks(lines);
  }

  private readConfigLines(): string[] {
    if (!fs.existsSync(SSH_CONFIG_PATH)) {
      return [];
    }
    try {
      return fs.readFileSync(SSH_CONFIG_PATH, 'utf-8').split('\n');
    } catch {
      return [];
    }
  }

  /** Write the SSH config atomically, preserving 0600 permissions. */
  private writeConfig(content: string): void {
    this.ensureSSHConfigExists();
    const tmp = `${SSH_CONFIG_PATH}.gitflip-tmp`;
    fs.writeFileSync(tmp, content, { mode: 0o600 });
    fs.renameSync(tmp, SSH_CONFIG_PATH);
  }

  private ensureSSHConfigExists(): void {
    const sshDir = path.dirname(SSH_CONFIG_PATH);
    if (!fs.existsSync(sshDir)) {
      fs.mkdirSync(sshDir, { mode: 0o700, recursive: true });
    }
    if (!fs.existsSync(SSH_CONFIG_PATH)) {
      fs.writeFileSync(SSH_CONFIG_PATH, '', { mode: 0o600 });
    }
  }
}
