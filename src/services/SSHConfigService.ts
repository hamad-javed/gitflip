import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';
import * as vscode from 'vscode';
import { Profile } from '../types';

const SSH_CONFIG_PATH = path.join(os.homedir(), '.ssh', 'config');
const MARKER_PREFIX = '# GitSwitch:';

interface SSHHostEntry {
  marker: string;
  host: string;
  hostName: string;
  user: string;
  identityFile: string;
}

export class SSHConfigService {
  addHostEntry(profile: Profile): void {
    if (!profile.sshKeyPath || !profile.sshHost) {
      return;
    }

    // Check if this host already exists in the config (any origin, not just GitSwitch)
    const existingHosts = this.getAllSSHConfigHosts();
    if (existingHosts.some(h => h.host === profile.sshHost)) {
      return;
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

    this.ensureSSHConfigExists();
    const existing = fs.readFileSync(SSH_CONFIG_PATH, 'utf-8');
    fs.writeFileSync(SSH_CONFIG_PATH, existing + entry, 'utf-8');
  }

  removeHostEntry(hostAlias: string): void {
    if (!fs.existsSync(SSH_CONFIG_PATH)) {
      return;
    }

    const content = fs.readFileSync(SSH_CONFIG_PATH, 'utf-8');
    const lines = content.split('\n');
    const result: string[] = [];
    let skipping = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Start skipping when we find a GitSwitch marker followed by matching Host
      if (line.startsWith(MARKER_PREFIX)) {
        const nextLine = lines[i + 1];
        if (nextLine && nextLine.trim() === `Host ${hostAlias}`) {
          skipping = true;
          continue;
        }
      }

      if (skipping) {
        // Stop skipping at next Host block or another marker
        if ((line.startsWith('Host ') && !line.startsWith('HostName')) || line.startsWith(MARKER_PREFIX)) {
          skipping = false;
          result.push(line);
        }
        // Skip indented lines belonging to the current Host block
        continue;
      }

      result.push(line);
    }

    fs.writeFileSync(SSH_CONFIG_PATH, result.join('\n'), 'utf-8');
  }

  updateRemoteUrl(profile: Profile): void {
    if (!profile.sshHost) {
      return;
    }

    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
      return;
    }

    try {
      const currentUrl = execSync('git remote get-url origin', {
        cwd: workspacePath,
        encoding: 'utf-8',
      }).trim();

      // Match SSH-style URLs: git@github.com:user/repo.git or git@host-alias:user/repo.git
      const sshMatch = currentUrl.match(/^git@[^:]+:(.+)$/);
      if (sshMatch) {
        const repoPath = sshMatch[1];
        const newUrl = `git@${profile.sshHost}:${repoPath}`;
        execSync(`git remote set-url origin "${newUrl}"`, {
          cwd: workspacePath,
          encoding: 'utf-8',
        });
      }
    } catch {
      // No remote or not a git repo - silently skip
    }
  }

  getExistingEntries(): SSHHostEntry[] {
    if (!fs.existsSync(SSH_CONFIG_PATH)) {
      return [];
    }

    const content = fs.readFileSync(SSH_CONFIG_PATH, 'utf-8');
    const lines = content.split('\n');
    const entries: SSHHostEntry[] = [];
    let currentMarker = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith(MARKER_PREFIX)) {
        currentMarker = line.substring(MARKER_PREFIX.length).trim();
      } else if (line.startsWith('Host ') && currentMarker) {
        const entry: Partial<SSHHostEntry> = {
          marker: currentMarker,
          host: line.substring(5).trim(),
        };

        // Read subsequent indented lines
        for (let j = i + 1; j < lines.length; j++) {
          const sub = lines[j].trim();
          if (sub.startsWith('HostName ')) {
            entry.hostName = sub.substring(9).trim();
          } else if (sub.startsWith('User ')) {
            entry.user = sub.substring(5).trim();
          } else if (sub.startsWith('IdentityFile ')) {
            entry.identityFile = sub.substring(13).trim();
          } else if (!sub || sub.startsWith('Host ') || sub.startsWith('#')) {
            break;
          }
        }

        if (entry.host && entry.identityFile) {
          entries.push(entry as SSHHostEntry);
        }
        currentMarker = '';
      }
    }

    return entries;
  }

  discoverSSHKeys(): { name: string; path: string; hasPublicKey: boolean }[] {
    const sshDir = path.join(os.homedir(), '.ssh');
    if (!fs.existsSync(sshDir)) {
      return [];
    }

    const files = fs.readdirSync(sshDir);
    const publicKeyFiles = new Set(files.filter(f => f.endsWith('.pub')).map(f => f.slice(0, -4)));

    const keys: { name: string; path: string; hasPublicKey: boolean }[] = [];

    for (const file of files) {
      // Skip non-key files
      if (
        file.startsWith('.') ||
        file.endsWith('.pub') ||
        file === 'config' ||
        file === 'known_hosts' ||
        file === 'known_hosts.old' ||
        file === 'authorized_keys' ||
        file === 'environment'
      ) {
        continue;
      }

      const fullPath = path.join(sshDir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) {
          continue;
        }

        // Quick check: private keys start with "-----BEGIN"
        const head = Buffer.alloc(32);
        const fd = fs.openSync(fullPath, 'r');
        fs.readSync(fd, head, 0, 32, 0);
        fs.closeSync(fd);
        const headerStr = head.toString('utf-8');
        if (!headerStr.startsWith('-----BEGIN')) {
          continue;
        }

        keys.push({
          name: file,
          path: fullPath,
          hasPublicKey: publicKeyFiles.has(file),
        });
      } catch {
        // Skip unreadable files
      }
    }

    return keys;
  }

  getAllSSHConfigHosts(): { host: string; identityFile?: string }[] {
    if (!fs.existsSync(SSH_CONFIG_PATH)) {
      return [];
    }

    const content = fs.readFileSync(SSH_CONFIG_PATH, 'utf-8');
    const lines = content.split('\n');
    const seen = new Set<string>();
    const hosts: { host: string; identityFile?: string }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('Host ') && !line.includes('*')) {
        const host = line.substring(5).trim();

        // Skip duplicates — keep the first occurrence
        if (seen.has(host)) {
          continue;
        }
        seen.add(host);

        let identityFile: string | undefined;

        for (let j = i + 1; j < lines.length; j++) {
          const sub = lines[j].trim();
          if (sub.startsWith('Host ') || (!sub && lines[j + 1]?.trim().startsWith('Host '))) {
            break;
          }
          if (sub.startsWith('IdentityFile ')) {
            identityFile = sub.substring(13).trim();
          }
        }

        hosts.push({ host, identityFile });
      }
    }

    return hosts;
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
