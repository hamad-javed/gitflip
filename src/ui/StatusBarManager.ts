import * as vscode from 'vscode';
import { ProfileManager } from '../services/ProfileManager';
import { GitConfigService } from '../services/GitConfigService';
import { GitUtil } from '../services/GitUtil';
import { resolveAuthMethod } from '../types';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private profileManager: ProfileManager,
    private gitConfig: GitConfigService
  ) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = 'gitflip.switchProfile';
    this.update();
    this.statusBarItem.show();

    this.disposables.push(
      profileManager.onDidChange(() => this.update()),
      // The active repository changes as the user moves between editors, which
      // can change whether the repo's identity matches the active profile.
      vscode.window.onDidChangeActiveTextEditor(() => this.update())
    );
  }

  update(): void {
    const active = this.profileManager.getActiveProfile();
    if (!active) {
      this.statusBarItem.text = '$(account) GitFlip';
      this.statusBarItem.tooltip = 'Click to switch GitHub profile';
      this.statusBarItem.backgroundColor = undefined;
      return;
    }

    const method = resolveAuthMethod(active);
    const baseTooltip = [
      `GitFlip: ${active.name}`,
      `Name: ${active.gitUserName}`,
      `Email: ${active.gitEmail}`,
      method === 'ssh' && active.sshHost ? `SSH: ${active.sshHost}` : null,
      method === 'https' ? 'Auth: HTTPS (Token)' : null,
      method === 'none' ? 'Auth: Git config only' : null,
    ]
      .filter(Boolean)
      .join('\n');

    // Compare the active profile against the current repo's actual identity.
    const mismatch = this.detectMismatch(active.gitEmail);
    if (mismatch) {
      this.statusBarItem.text = `$(warning) ${active.name}`;
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      this.statusBarItem.tooltip = `${baseTooltip}\n\n⚠ This repo's git email is "${mismatch}", not the active profile's. Click to switch.`;
    } else {
      this.statusBarItem.text = `$(account) ${active.name}`;
      this.statusBarItem.backgroundColor = undefined;
      this.statusBarItem.tooltip = baseTooltip;
    }
  }

  /**
   * If the current repo has a local git email that differs from the active
   * profile's, return the repo's email. Returns undefined when there is no
   * repo, no local email set, or the identity already matches.
   */
  private detectMismatch(profileEmail: string): string | undefined {
    if (!GitUtil.isGitAvailable()) {
      return undefined;
    }
    const repoRoot = GitUtil.resolveRepoRoot();
    if (!repoRoot) {
      return undefined;
    }
    const actual = this.gitConfig.getCurrentUser('local', repoRoot).email;
    if (!actual) {
      return undefined; // No repo-local email; nothing to contradict.
    }
    return actual.toLowerCase() === profileEmail.trim().toLowerCase() ? undefined : actual;
  }

  dispose(): void {
    this.statusBarItem.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
