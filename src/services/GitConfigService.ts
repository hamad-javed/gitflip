import { execSync } from 'child_process';
import * as vscode from 'vscode';
import { GitConfigScope, GitUser, Profile } from '../types';

export class GitConfigService {
  private getWorkspacePath(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    return folders?.[0]?.uri.fsPath;
  }

  getCurrentUser(scope: GitConfigScope = 'local'): GitUser {
    const cwd = this.getWorkspacePath();
    const flag = scope === 'local' ? '--local' : '--global';

    return {
      name: this.getConfigValue(`user.name`, flag, cwd),
      email: this.getConfigValue(`user.email`, flag, cwd),
    };
  }

  switchUser(profile: Profile, scope: GitConfigScope): void {
    const cwd = this.getWorkspacePath();
    const flag = scope === 'local' ? '--local' : '--global';

    if (scope === 'local' && !cwd) {
      throw new Error('No workspace folder open. Open a repository to set local git config.');
    }

    this.setConfigValue('user.name', profile.gitUserName, flag, cwd);
    this.setConfigValue('user.email', profile.gitEmail, flag, cwd);
  }

  private getConfigValue(key: string, flag: string, cwd?: string): string | undefined {
    try {
      const opts = cwd ? { cwd, encoding: 'utf-8' as const } : { encoding: 'utf-8' as const };
      return execSync(`git config ${flag} ${key}`, opts).trim() || undefined;
    } catch {
      return undefined;
    }
  }

  private setConfigValue(key: string, value: string, flag: string, cwd?: string): void {
    const opts = cwd ? { cwd, encoding: 'utf-8' as const } : { encoding: 'utf-8' as const };
    execSync(`git config ${flag} ${key} "${value}"`, opts);
  }
}
