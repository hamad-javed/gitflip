import { execSync } from 'child_process';
import * as vscode from 'vscode';

export class CredentialHelperService {

  private getWorkspacePath(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  /**
   * Ensure a git credential helper is configured.
   * If none is found (local or global), set 'store' as a global fallback.
   */
  ensureCredentialHelper(): void {
    // Check global first
    try {
      const helper = execSync('git config --global credential.helper', {
        encoding: 'utf-8',
      }).trim();
      if (helper) { return; }
    } catch { /* not set */ }

    // Check local (if in a repo)
    const cwd = this.getWorkspacePath();
    if (cwd) {
      try {
        const helper = execSync('git config --local credential.helper', {
          cwd,
          encoding: 'utf-8',
        }).trim();
        if (helper) { return; }
      } catch { /* not set */ }
    }

    // Nothing configured — set 'store' globally as fallback
    execSync('git config --global credential.helper store', {
      encoding: 'utf-8',
    });
  }

  /**
   * Clear any cached credentials for the host, then approve new ones.
   */
  setCredentials(host: string, username: string, token: string): void {
    this.rejectCredentials(host);

    const input = [
      'protocol=https',
      `host=${host}`,
      `username=${username}`,
      `password=${token}`,
      '',
      '',
    ].join('\n');

    execSync('git credential approve', {
      input,
      encoding: 'utf-8',
    });
  }

  /**
   * Remove cached credentials for a host.
   */
  rejectCredentials(host: string): void {
    const input = [
      'protocol=https',
      `host=${host}`,
      '',
      '',
    ].join('\n');

    try {
      execSync('git credential reject', {
        input,
        encoding: 'utf-8',
      });
    } catch {
      // Credential may not exist — that is fine
    }
  }

  /**
   * Convert the current repo's origin remote from SSH to HTTPS format.
   * git@github.com:user/repo.git  →  https://github.com/user/repo.git
   * git@some-alias:user/repo.git  →  https://github.com/user/repo.git
   */
  convertRemoteToHttps(): void {
    const cwd = this.getWorkspacePath();
    if (!cwd) { return; }

    try {
      const currentUrl = execSync('git remote get-url origin', {
        cwd,
        encoding: 'utf-8',
      }).trim();

      const sshMatch = currentUrl.match(/^git@[^:]+:(.+)$/);
      if (sshMatch) {
        const repoPath = sshMatch[1];
        const httpsUrl = `https://github.com/${repoPath}`;
        execSync(`git remote set-url origin "${httpsUrl}"`, {
          cwd,
          encoding: 'utf-8',
        });
      }
    } catch {
      // Not a git repo or no origin remote — skip
    }
  }
}
