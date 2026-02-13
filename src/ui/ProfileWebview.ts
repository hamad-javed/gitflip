import * as vscode from 'vscode';
import { Profile } from '../types';
import { SSHConfigService } from '../services/SSHConfigService';

interface WebviewSaveMessage {
  command: 'save';
  data: {
    name: string;
    gitUserName: string;
    gitEmail: string;
    sshKeyPath: string;
    sshHost: string;
    token: string;
    useToken: boolean;
    avatarUrl: string;
  };
}

interface WebviewBrowseMessage {
  command: 'browseSSHKeys';
}

interface WebviewBrowseHostsMessage {
  command: 'browseSSHHosts';
}

interface WebviewBrowseAvatarMessage {
  command: 'browseAvatar';
}

type WebviewMessage = WebviewSaveMessage | WebviewBrowseMessage | WebviewBrowseHostsMessage | WebviewBrowseAvatarMessage;

export class ProfileWebview {
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private extensionUri: vscode.Uri,
    private sshConfigService: SSHConfigService,
    private onSave: (data: WebviewSaveMessage['data'], existingId?: string) => Promise<void>
  ) {}

  show(existingProfile?: Profile, existingToken?: string): void {
    if (this.panel) {
      this.panel.reveal();
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'gitflipProfile',
        existingProfile ? `Edit Profile: ${existingProfile.name}` : 'Add Profile',
        vscode.ViewColumn.One,
        { enableScripts: true }
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
    }

    this.panel.webview.html = this.getHtml(existingProfile, existingToken);

    this.panel.webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
      if (msg.command === 'save') {
        await this.onSave(msg.data, existingProfile?.id);
        this.panel?.dispose();
      } else if (msg.command === 'browseSSHKeys') {
        await this.handleBrowseSSHKeys();
      } else if (msg.command === 'browseSSHHosts') {
        await this.handleBrowseSSHHosts();
      } else if (msg.command === 'browseAvatar') {
        await this.handleBrowseAvatar();
      }
    });
  }

  private async handleBrowseSSHKeys(): Promise<void> {
    const keys = this.sshConfigService.discoverSSHKeys();

    if (keys.length === 0) {
      const action = await vscode.window.showInformationMessage(
        'No SSH keys found in ~/.ssh/. Would you like to browse for a key file manually?',
        'Browse Files'
      );
      if (action === 'Browse Files') {
        const uris = await vscode.window.showOpenDialog({
          title: 'Select SSH Private Key',
          defaultUri: vscode.Uri.file(require('os').homedir() + '/.ssh'),
          canSelectMany: false,
          openLabel: 'Select Key',
        });
        if (uris?.[0]) {
          this.panel?.webview.postMessage({
            command: 'setSSHKeyPath',
            path: uris[0].fsPath,
          });
        }
      }
      return;
    }

    const items = keys.map(k => ({
      label: k.name,
      description: k.path,
      detail: k.hasPublicKey ? 'Has matching .pub file' : 'No .pub file found',
      path: k.path,
    }));

    // Add a manual browse option at the end
    const picks: (typeof items[number] | vscode.QuickPickItem & { path?: string })[] = [
      ...items,
      { label: '$(folder-opened) Browse manually...', description: 'Pick a file from disk', path: undefined },
    ];

    const picked = await vscode.window.showQuickPick(picks, {
      placeHolder: 'Select an SSH key from ~/.ssh/',
      matchOnDescription: true,
    });

    if (!picked) {
      return;
    }

    if (picked.path) {
      this.panel?.webview.postMessage({
        command: 'setSSHKeyPath',
        path: picked.path,
      });
    } else {
      // Manual browse
      const uris = await vscode.window.showOpenDialog({
        title: 'Select SSH Private Key',
        defaultUri: vscode.Uri.file(require('os').homedir() + '/.ssh'),
        canSelectMany: false,
        openLabel: 'Select Key',
      });
      if (uris?.[0]) {
        this.panel?.webview.postMessage({
          command: 'setSSHKeyPath',
          path: uris[0].fsPath,
        });
      }
    }
  }

  private async handleBrowseSSHHosts(): Promise<void> {
    const hosts = this.sshConfigService.getAllSSHConfigHosts();

    if (hosts.length === 0) {
      vscode.window.showInformationMessage('No hosts found in ~/.ssh/config.');
      return;
    }

    const picked = await vscode.window.showQuickPick(
      hosts.map(h => ({
        label: h.host,
        description: h.identityFile ?? '',
        host: h.host,
      })),
      {
        placeHolder: 'Select an existing SSH host alias from ~/.ssh/config',
        matchOnDescription: true,
      }
    );

    if (picked) {
      this.panel?.webview.postMessage({
        command: 'setSSHHost',
        host: picked.host,
      });
    }
  }

  private async handleBrowseAvatar(): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      title: 'Select Profile Avatar',
      canSelectMany: false,
      openLabel: 'Select Image',
      filters: {
        'Images': ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'],
      },
    });
    if (uris?.[0]) {
      const fs = require('fs') as typeof import('fs');
      const path = require('path') as typeof import('path');
      const filePath = uris[0].fsPath;
      const ext = path.extname(filePath).toLowerCase().replace('.', '');
      const mimeMap: Record<string, string> = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
        gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
      };
      const mime = mimeMap[ext] || 'image/png';
      const data = fs.readFileSync(filePath);
      const base64 = data.toString('base64');
      const dataUri = `data:${mime};base64,${base64}`;
      this.panel?.webview.postMessage({
        command: 'setAvatar',
        url: dataUri,
      });
    }
  }

  private getHtml(profile?: Profile, token?: string): string {
    return /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${profile ? 'Edit' : 'Add'} Profile</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 20px;
      max-width: 500px;
      margin: 0 auto;
    }
    h2 {
      color: var(--vscode-foreground);
      margin-bottom: 20px;
      font-weight: 600;
    }
    .form-group {
      margin-bottom: 16px;
    }
    label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
      color: var(--vscode-foreground);
    }
    .hint {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 6px;
    }
    input[type="text"],
    input[type="password"] {
      width: 100%;
      padding: 6px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 2px;
      font-size: 13px;
      box-sizing: border-box;
    }
    input:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }
    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .checkbox-group label {
      margin-bottom: 0;
    }
    .separator {
      border-top: 1px solid var(--vscode-widget-border, #444);
      margin: 20px 0;
    }
    .section-title {
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 12px;
    }
    button {
      padding: 8px 16px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 2px;
      cursor: pointer;
      font-size: 13px;
      margin-top: 8px;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .input-row {
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }
    .input-row input {
      flex: 1;
    }
    .browse-btn {
      padding: 6px 12px;
      margin-top: 0;
      white-space: nowrap;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .browse-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .avatar-section {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
    }
    .avatar-preview {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: var(--vscode-input-background);
      border: 2px solid var(--vscode-input-border, var(--vscode-widget-border, #444));
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
    }
    .avatar-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .avatar-placeholder {
      font-size: 28px;
      color: var(--vscode-descriptionForeground);
      opacity: 0.5;
    }
    .avatar-controls {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .avatar-controls label {
      margin-bottom: 0;
      font-weight: 500;
    }
    .avatar-btns {
      display: flex;
      gap: 6px;
    }
    .avatar-btns button {
      padding: 4px 10px;
      font-size: 12px;
      margin-top: 0;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .avatar-btns button:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .avatar-url-row {
      display: flex;
      gap: 6px;
      align-items: center;
      margin-top: 4px;
    }
    .avatar-url-row input {
      flex: 1;
      padding: 4px 8px;
      font-size: 12px;
    }
    .avatar-btns .remove-btn {
      color: var(--vscode-errorForeground);
    }
  </style>
</head>
<body>
  <h2>${profile ? 'Edit' : 'New'} GitHub Profile</h2>

  <div class="avatar-section">
    <div class="avatar-preview" id="avatarPreview">
      ${profile?.avatarUrl
        ? `<img src="${profile.avatarUrl}" alt="avatar" />`
        : '<span class="avatar-placeholder">&#x1F464;</span>'}
    </div>
    <div class="avatar-controls">
      <label>Profile Avatar</label>
      <div class="avatar-btns">
        <button type="button" id="browseAvatarBtn">Upload Image</button>
        <button type="button" id="toggleUrlBtn">Paste URL</button>
        <button type="button" class="remove-btn" id="removeAvatarBtn">Remove</button>
      </div>
      <div class="avatar-url-row" id="avatarUrlRow" style="display:none;">
        <input type="text" id="avatarUrlInput" placeholder="https://github.com/username.png" value="${profile?.avatarUrl && !profile.avatarUrl.startsWith('data:') ? profile.avatarUrl : ''}" />
        <button type="button" class="browse-btn" id="applyUrlBtn" style="padding:4px 10px;font-size:12px;margin-top:0;">Apply</button>
      </div>
    </div>
  </div>
  <input type="hidden" id="avatarUrl" value="${profile?.avatarUrl ?? ''}" />

  <div class="form-group">
    <label for="name">Profile Name</label>
    <div class="hint">A friendly name like "Work" or "Personal"</div>
    <input type="text" id="name" value="${profile?.name ?? ''}" placeholder="e.g. Personal" />
  </div>

  <div class="separator"></div>
  <div class="section-title">Git Configuration</div>

  <div class="form-group">
    <label for="gitUserName">Git User Name</label>
    <input type="text" id="gitUserName" value="${profile?.gitUserName ?? ''}" placeholder="e.g. John Doe" />
  </div>

  <div class="form-group">
    <label for="gitEmail">Git Email</label>
    <input type="text" id="gitEmail" value="${profile?.gitEmail ?? ''}" placeholder="e.g. john@example.com" />
  </div>

  <div class="separator"></div>
  <div class="section-title">SSH Configuration (Optional)</div>

  <div class="form-group">
    <label for="sshKeyPath">SSH Private Key Path</label>
    <div class="hint">Full path to your SSH key, or click "Browse" to discover keys in ~/.ssh/</div>
    <div class="input-row">
      <input type="text" id="sshKeyPath" value="${profile?.sshKeyPath ?? ''}" placeholder="~/.ssh/id_ed25519" />
      <button class="browse-btn" id="browseKeysBtn" type="button">Browse Keys</button>
    </div>
  </div>

  <div class="form-group">
    <label for="sshHost">SSH Host Alias</label>
    <div class="hint">A unique alias, or click "Browse" to pick from existing ~/.ssh/config hosts</div>
    <div class="input-row">
      <input type="text" id="sshHost" value="${profile?.sshHost ?? ''}" placeholder="e.g. github-personal" />
      <button class="browse-btn" id="browseHostsBtn" type="button">Browse Hosts</button>
    </div>
  </div>

  <div class="separator"></div>
  <div class="section-title">Token Configuration (Optional)</div>

  <div class="form-group checkbox-group">
    <input type="checkbox" id="useToken" ${profile?.useToken ? 'checked' : ''} />
    <label for="useToken">Use Personal Access Token</label>
  </div>

  <div class="form-group" id="tokenGroup" style="display: ${profile?.useToken ? 'block' : 'none'}">
    <label for="token">GitHub Personal Access Token</label>
    <div class="hint">Stored securely in VS Code's secret storage</div>
    <input type="password" id="token" value="${token ?? ''}" placeholder="ghp_..." />
  </div>

  <button id="saveBtn">${profile ? 'Save Changes' : 'Create Profile'}</button>

  <script>
    const vscode = acquireVsCodeApi();

    function updateAvatarPreview(url) {
      const preview = document.getElementById('avatarPreview');
      const hidden = document.getElementById('avatarUrl');
      if (url) {
        preview.innerHTML = '<img src="' + url + '" alt="avatar" />';
        hidden.value = url;
      } else {
        preview.innerHTML = '<span class="avatar-placeholder">&#x1F464;</span>';
        hidden.value = '';
      }
    }

    // Listen for messages from the extension (browse results)
    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.command === 'setSSHKeyPath') {
        document.getElementById('sshKeyPath').value = msg.path;
      } else if (msg.command === 'setSSHHost') {
        document.getElementById('sshHost').value = msg.host;
      } else if (msg.command === 'setAvatar') {
        updateAvatarPreview(msg.url);
      }
    });

    document.getElementById('browseAvatarBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'browseAvatar' });
    });

    document.getElementById('toggleUrlBtn').addEventListener('click', () => {
      const row = document.getElementById('avatarUrlRow');
      row.style.display = row.style.display === 'none' ? 'flex' : 'none';
    });

    document.getElementById('applyUrlBtn').addEventListener('click', () => {
      const url = document.getElementById('avatarUrlInput').value.trim();
      if (url) {
        updateAvatarPreview(url);
        document.getElementById('avatarUrlRow').style.display = 'none';
      }
    });

    document.getElementById('removeAvatarBtn').addEventListener('click', () => {
      updateAvatarPreview('');
      document.getElementById('avatarUrlInput').value = '';
    });

    document.getElementById('browseKeysBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'browseSSHKeys' });
    });

    document.getElementById('browseHostsBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'browseSSHHosts' });
    });

    document.getElementById('useToken').addEventListener('change', (e) => {
      document.getElementById('tokenGroup').style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('saveBtn').addEventListener('click', () => {
      const name = document.getElementById('name').value.trim();
      const gitUserName = document.getElementById('gitUserName').value.trim();
      const gitEmail = document.getElementById('gitEmail').value.trim();

      if (!name || !gitUserName || !gitEmail) {
        return;
      }

      vscode.postMessage({
        command: 'save',
        data: {
          name,
          gitUserName,
          gitEmail,
          sshKeyPath: document.getElementById('sshKeyPath').value.trim(),
          sshHost: document.getElementById('sshHost').value.trim(),
          useToken: document.getElementById('useToken').checked,
          token: document.getElementById('token').value.trim(),
          avatarUrl: document.getElementById('avatarUrl').value,
        }
      });
    });
  </script>
</body>
</html>`;
  }

  dispose(): void {
    this.panel?.dispose();
  }
}
