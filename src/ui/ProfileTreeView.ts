import * as vscode from 'vscode';
import { Profile } from '../types';
import { ProfileManager } from '../services/ProfileManager';

export class ProfileTreeItem extends vscode.TreeItem {
  constructor(public readonly profile: Profile, isActive: boolean) {
    super(profile.name, vscode.TreeItemCollapsibleState.None);

    // Build a concise description with auth badges
    const badges: string[] = [];
    if (profile.sshHost) { badges.push('SSH'); }
    if (profile.useToken) { badges.push('Token'); }
    const badgeStr = badges.length > 0 ? ` [${badges.join(', ')}]` : '';
    this.description = `${profile.gitUserName} <${profile.gitEmail}>${badgeStr}`;

    this.iconPath = new vscode.ThemeIcon(
      isActive ? 'pass-filled' : 'account',
      isActive ? new vscode.ThemeColor('charts.green') : undefined
    );

    // Distinguish active vs inactive for conditional inline actions
    this.contextValue = isActive ? 'activeProfile' : 'profile';

    this.tooltip = new vscode.MarkdownString(
      [
        `### ${profile.name}${isActive ? ' ✅ Active' : ''}`,
        '',
        `**User:** ${profile.gitUserName}`,
        `**Email:** ${profile.gitEmail}`,
        profile.sshHost ? `**SSH Host:** ${profile.sshHost}` : null,
        profile.sshKeyPath ? `**SSH Key:** \`${profile.sshKeyPath}\`` : null,
        profile.useToken ? `**Token:** configured` : null,
      ]
        .filter(Boolean)
        .join('\n\n'),
      true
    );
  }
}

export class ProfileTreeViewProvider implements vscode.TreeDataProvider<ProfileTreeItem> {
  private onDidChangeTreeDataEmitter = new vscode.EventEmitter<ProfileTreeItem | undefined>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private profileManager: ProfileManager) {
    profileManager.onDidChange(() => this.refresh());
  }

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  getTreeItem(element: ProfileTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): ProfileTreeItem[] {
    const profiles = this.profileManager.getProfiles();
    const activeId = this.profileManager.getActiveProfileId();

    return profiles.map(p => new ProfileTreeItem(p, p.id === activeId));
  }

  dispose(): void {
    this.onDidChangeTreeDataEmitter.dispose();
  }
}
