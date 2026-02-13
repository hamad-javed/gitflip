import * as vscode from 'vscode';
import { Profile } from '../types';
import { ProfileManager } from '../services/ProfileManager';

export class ProfileSidebarViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'gitflipProfiles';

  private view?: vscode.WebviewView;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly profileManager: ProfileManager
  ) {
    this.disposables.push(
      profileManager.onDidChange(() => this.refresh())
    );
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.onDidReceiveMessage((msg) => {
      switch (msg.command) {
        case 'switch':
          vscode.commands.executeCommand('gitflip.switchProfile', msg.id);
          break;
        case 'edit':
          vscode.commands.executeCommand('gitflip.editProfile', msg.id);
          break;
        case 'delete':
          vscode.commands.executeCommand('gitflip.removeProfile', msg.id);
          break;
        case 'duplicate':
          vscode.commands.executeCommand('gitflip.duplicateProfile', msg.id);
          break;
        case 'add':
          vscode.commands.executeCommand('gitflip.addProfile');
          break;
      }
    });

    this.updateHtml();
  }

  refresh(): void {
    this.updateHtml();
  }

  private updateHtml(): void {
    if (!this.view) {
      return;
    }
    const profiles = this.profileManager.getProfiles();
    const activeId = this.profileManager.getActiveProfileId();
    this.view.webview.html = this.getHtml(profiles, activeId);
  }

  private getHtml(profiles: Profile[], activeId: string | undefined): string {
    const profileCards = profiles.map(p => {
      const isActive = p.id === activeId;
      const badges: string[] = [];
      if (p.sshHost) { badges.push('SSH'); }
      if (p.useToken) { badges.push('Token'); }

      const avatarHtml = p.avatarUrl
        ? `<img class="avatar-img" src="${this.escapeHtml(p.avatarUrl)}" alt="" />`
        : `<svg class="avatar-default" width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM3 13s-1 0-1-1 1-5 6-5 6 4 6 5-1 1-1 1H3z"/></svg>`;

      return /* html */ `
        <div class="profile-card ${isActive ? 'active' : ''}">
          <div class="avatar">${avatarHtml}${isActive ? '<span class="avatar-active-dot"></span>' : ''}</div>
          <div class="profile-info">
            <div class="profile-header">
              <span class="profile-name">${this.escapeHtml(p.name)}</span>
              ${isActive ? '<span class="active-badge">Active</span>' : ''}
            </div>
            <div class="profile-details">
              <span class="detail-text">${this.escapeHtml(p.gitUserName)} &lt;${this.escapeHtml(p.gitEmail)}&gt;</span>
            </div>
            ${badges.length > 0 ? `
              <div class="profile-badges">
                ${badges.map(b => `<span class="badge">${b}</span>`).join('')}
              </div>
            ` : ''}
          </div>
          <div class="profile-actions">
            ${!isActive ? `<button class="action-btn switch-btn" title="Switch to this profile" onclick="send('switch','${p.id}')">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M5.22 14.78a.75.75 0 0 0 1.06-1.06L4.56 12h8.69a.75.75 0 0 0 0-1.5H4.56l1.72-1.72a.75.75 0 0 0-1.06-1.06l-3 3a.75.75 0 0 0 0 1.06l3 3zm5.56-6.5a.75.75 0 0 1 0-1.06l3-3a.75.75 0 0 1 1.06 0l-.53.53.53-.53a.75.75 0 0 1 0 1.06L13.12 6h-8.69a.75.75 0 0 1 0-1.5h8.69l-1.28-1.28-.53-.53a.75.75 0 0 1 0-1.06z" clip-rule="evenodd"/></svg>
            </button>` : ''}
            <button class="action-btn edit-btn" title="Edit" onclick="send('edit','${p.id}')">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.23 1h-1.46L3.52 9.25l-.16.22L1 13.59 2.41 15l4.12-2.36.22-.16L15 4.23V2.77L13.23 1zM2.41 13.59l1.51-3 1.45 1.45-2.96 1.55zm3.83-2.06L4.47 9.76l6-5.96 1.77 1.77-6 5.96z"/></svg>
            </button>
            <button class="action-btn duplicate-btn" title="Duplicate" onclick="send('duplicate','${p.id}')">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4 4h1V2h7v7h-2v1h3V1H4v3zm-1 1H1v10h10v-2H3V5z"/></svg>
            </button>
            <button class="action-btn delete-btn" title="Delete" onclick="send('delete','${p.id}')">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M10 3h3v1h-1v9l-1 1H5l-1-1V4H3V3h3V2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1zM9 2H7v1h2V2zM5 4v9h6V4H5zm1 2h1v5H6V6zm3 0h1v5H9V6z"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    const emptyState = profiles.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">&#x1F464;</div>
        <p>No profiles yet</p>
        <button class="add-btn" onclick="send('add')">+ Add Profile</button>
      </div>
    ` : '';

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: transparent;
      padding: 8px;
    }

    .profile-card {
      display: flex;
      align-items: center;
      padding: 10px 10px;
      margin-bottom: 6px;
      border-radius: 6px;
      background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.04));
      border: 1px solid transparent;
      transition: border-color 0.15s, background 0.15s;
    }

    .profile-card:hover {
      border-color: var(--vscode-focusBorder);
    }

    .profile-card.active {
      background: var(--vscode-list-activeSelectionBackground, rgba(255,255,255,0.08));
      border-color: var(--vscode-charts-green, #89d185);
    }

    .avatar {
      position: relative;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: var(--vscode-input-background);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-right: 10px;
    }

    .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
      clip-path: circle(50%);
    }

    .avatar-default {
      color: var(--vscode-descriptionForeground);
      opacity: 0.6;
    }

    .avatar-active-dot {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--vscode-charts-green, #89d185);
      border: 2px solid var(--vscode-sideBar-background, var(--vscode-editor-background));
    }

    .profile-info {
      flex: 1;
      min-width: 0;
      margin-right: 4px;
    }

    .profile-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 2px;
    }

    .profile-name {
      font-weight: 600;
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .active-badge {
      font-size: 9px;
      padding: 1px 5px;
      border-radius: 10px;
      background: var(--vscode-charts-green, #89d185);
      color: var(--vscode-editor-background, #1e1e1e);
      font-weight: 600;
      flex-shrink: 0;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .profile-details {
      margin-bottom: 3px;
    }

    .detail-text {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }

    .profile-badges {
      display: flex;
      gap: 4px;
    }

    .badge {
      font-size: 9px;
      padding: 1px 5px;
      border-radius: 3px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .profile-actions {
      display: flex;
      gap: 1px;
      flex-shrink: 0;
      align-items: center;
      opacity: 0.5;
      transition: opacity 0.15s;
    }

    .profile-card:hover .profile-actions {
      opacity: 1;
    }

    .action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      transition: background 0.1s, color 0.1s;
    }

    .action-btn:hover {
      background: var(--vscode-toolbar-hoverBackground, rgba(255,255,255,0.12));
      color: var(--vscode-foreground);
    }

    .action-btn.switch-btn:hover {
      color: var(--vscode-charts-blue, #6cb2f7);
    }

    .action-btn.edit-btn:hover {
      color: var(--vscode-charts-yellow, #d7ba7d);
    }

    .action-btn.delete-btn:hover {
      color: var(--vscode-charts-red, #f48771);
    }

    .action-btn svg {
      width: 14px;
      height: 14px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 16px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
    }

    .empty-icon {
      font-size: 32px;
      margin-bottom: 12px;
      opacity: 0.5;
    }

    .empty-state p {
      margin-bottom: 16px;
      font-size: 13px;
    }

    .add-btn {
      padding: 6px 16px;
      border: none;
      border-radius: 4px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      font-size: 12px;
      cursor: pointer;
    }

    .add-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
  </style>
</head>
<body>
  ${emptyState}
  ${profileCards}
  <script>
    const vscode = acquireVsCodeApi();
    function send(command, id) {
      vscode.postMessage({ command, id });
    }
  </script>
</body>
</html>`;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
