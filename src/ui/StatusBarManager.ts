import * as vscode from 'vscode';
import { ProfileManager } from '../services/ProfileManager';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;

  constructor(private profileManager: ProfileManager) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = 'gitswitch.switchProfile';
    this.update();
    this.statusBarItem.show();

    profileManager.onDidChange(() => this.update());
  }

  update(): void {
    const active = this.profileManager.getActiveProfile();
    if (active) {
      this.statusBarItem.text = `$(account) ${active.name}`;
      this.statusBarItem.tooltip = [
        `GitSwitch: ${active.name}`,
        `Name: ${active.gitUserName}`,
        `Email: ${active.gitEmail}`,
        active.sshHost ? `SSH: ${active.sshHost}` : null,
        active.useToken ? `Token: configured` : null,
      ]
        .filter(Boolean)
        .join('\n');
    } else {
      this.statusBarItem.text = '$(account) GitSwitch';
      this.statusBarItem.tooltip = 'Click to switch GitHub profile';
    }
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
