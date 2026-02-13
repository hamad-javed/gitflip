import * as vscode from 'vscode';
import { Profile } from '../types';
import { ProfileManager } from '../services/ProfileManager';

export class ProfileTreeItem extends vscode.TreeItem {
  constructor(public readonly profile: Profile, isActive: boolean) {
    super(profile.name, vscode.TreeItemCollapsibleState.None);

    this.description = `${profile.gitUserName} <${profile.gitEmail}>`;
    this.iconPath = new vscode.ThemeIcon(isActive ? 'check' : 'account');
    this.contextValue = 'profile';

    this.tooltip = [
      `Name: ${profile.gitUserName}`,
      `Email: ${profile.gitEmail}`,
      profile.sshHost ? `SSH Host: ${profile.sshHost}` : null,
      profile.sshKeyPath ? `SSH Key: ${profile.sshKeyPath}` : null,
      profile.useToken ? `Token: configured` : null,
      isActive ? '\n(Active)' : null,
    ]
      .filter(Boolean)
      .join('\n');

    this.command = {
      command: 'gitswitch.switchProfile',
      title: 'Switch to this profile',
      arguments: [profile.id],
    };
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
