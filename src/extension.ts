import * as vscode from 'vscode';
import { ProfileManager } from './services/ProfileManager';
import { GitConfigService } from './services/GitConfigService';
import { SSHConfigService } from './services/SSHConfigService';
import { TokenManager } from './services/TokenManager';
import { StatusBarManager } from './ui/StatusBarManager';
import { ProfileTreeViewProvider } from './ui/ProfileTreeView';
import { ProfileWebview } from './ui/ProfileWebview';
import { GitConfigScope } from './types';

export function activate(context: vscode.ExtensionContext) {
  const profileManager = new ProfileManager(context);
  const gitConfig = new GitConfigService();
  const sshConfig = new SSHConfigService();
  const tokenManager = new TokenManager(context);
  const statusBar = new StatusBarManager(profileManager);
  const treeProvider = new ProfileTreeViewProvider(profileManager);

  const treeView = vscode.window.createTreeView('gitswitchProfiles', {
    treeDataProvider: treeProvider,
  });

  // --- Webview helper ---
  const webview = new ProfileWebview(
    context.extensionUri,
    sshConfig,
    async (data, existingId) => {
      if (existingId) {
        await profileManager.updateProfile(existingId, {
          name: data.name,
          gitUserName: data.gitUserName,
          gitEmail: data.gitEmail,
          sshKeyPath: data.sshKeyPath || undefined,
          sshHost: data.sshHost || undefined,
          useToken: data.useToken,
        });

        if (data.useToken && data.token) {
          await tokenManager.storeToken(existingId, data.token);
        } else if (!data.useToken) {
          await tokenManager.deleteToken(existingId);
        }

        const profile = profileManager.getProfile(existingId);
        if (profile?.sshKeyPath && profile?.sshHost) {
          sshConfig.addHostEntry(profile);
        }

        vscode.window.showInformationMessage(`Profile "${data.name}" updated.`);
      } else {
        const profile = await profileManager.addProfile({
          name: data.name,
          gitUserName: data.gitUserName,
          gitEmail: data.gitEmail,
          sshKeyPath: data.sshKeyPath || undefined,
          sshHost: data.sshHost || undefined,
          useToken: data.useToken,
        });

        if (data.useToken && data.token) {
          await tokenManager.storeToken(profile.id, data.token);
        }

        if (profile.sshKeyPath && profile.sshHost) {
          sshConfig.addHostEntry(profile);
        }

        vscode.window.showInformationMessage(`Profile "${data.name}" created.`);
      }
    }
  );

  // --- Commands ---

  const addProfileCmd = vscode.commands.registerCommand('gitswitch.addProfile', () => {
    webview.show();
  });

  const editProfileCmd = vscode.commands.registerCommand('gitswitch.editProfile', async (arg?: unknown) => {
    let profileId: string | undefined;

    // Called from tree view context menu
    if (arg && typeof arg === 'object' && 'profile' in (arg as Record<string, unknown>)) {
      profileId = ((arg as Record<string, unknown>).profile as { id: string }).id;
    }

    if (!profileId) {
      const profiles = profileManager.getProfiles();
      if (profiles.length === 0) {
        vscode.window.showInformationMessage('No profiles yet. Add one first.');
        return;
      }

      const picked = await vscode.window.showQuickPick(
        profiles.map(p => ({ label: p.name, description: `${p.gitUserName} <${p.gitEmail}>`, id: p.id })),
        { placeHolder: 'Select a profile to edit' }
      );
      if (!picked) {
        return;
      }
      profileId = picked.id;
    }

    const profile = profileManager.getProfile(profileId);
    if (!profile) {
      return;
    }

    const existingToken = profile.useToken ? await tokenManager.getToken(profileId) : undefined;
    webview.show(profile, existingToken);
  });

  const removeProfileCmd = vscode.commands.registerCommand('gitswitch.removeProfile', async (arg?: unknown) => {
    let profileId: string | undefined;

    if (arg && typeof arg === 'object' && 'profile' in (arg as Record<string, unknown>)) {
      profileId = ((arg as Record<string, unknown>).profile as { id: string }).id;
    }

    if (!profileId) {
      const profiles = profileManager.getProfiles();
      if (profiles.length === 0) {
        vscode.window.showInformationMessage('No profiles to remove.');
        return;
      }

      const picked = await vscode.window.showQuickPick(
        profiles.map(p => ({ label: p.name, description: `${p.gitUserName} <${p.gitEmail}>`, id: p.id })),
        { placeHolder: 'Select a profile to remove' }
      );
      if (!picked) {
        return;
      }
      profileId = picked.id;
    }

    const profile = profileManager.getProfile(profileId);
    if (!profile) {
      return;
    }

    const confirm = await vscode.window.showWarningMessage(
      `Remove profile "${profile.name}"?`,
      { modal: true },
      'Remove'
    );

    if (confirm === 'Remove') {
      if (profile.sshHost) {
        sshConfig.removeHostEntry(profile.sshHost);
      }
      await tokenManager.deleteToken(profileId);
      await profileManager.removeProfile(profileId);
      vscode.window.showInformationMessage(`Profile "${profile.name}" removed.`);
    }
  });

  const switchProfileCmd = vscode.commands.registerCommand('gitswitch.switchProfile', async (directId?: string) => {
    let profileId: string | undefined = typeof directId === 'string' ? directId : undefined;

    if (!profileId) {
      const profiles = profileManager.getProfiles();
      if (profiles.length === 0) {
        const action = await vscode.window.showInformationMessage(
          'No profiles yet. Would you like to create one?',
          'Add Profile'
        );
        if (action === 'Add Profile') {
          vscode.commands.executeCommand('gitswitch.addProfile');
        }
        return;
      }

      const activeId = profileManager.getActiveProfileId();
      const picked = await vscode.window.showQuickPick(
        profiles.map(p => ({
          label: `${p.id === activeId ? '$(check) ' : ''}${p.name}`,
          description: `${p.gitUserName} <${p.gitEmail}>`,
          id: p.id,
        })),
        { placeHolder: 'Switch to profile...' }
      );
      if (!picked) {
        return;
      }
      profileId = picked.id;
    }

    const profile = profileManager.getProfile(profileId);
    if (!profile) {
      return;
    }

    // Ask for scope
    const config = vscode.workspace.getConfiguration('gitswitch');
    const defaultScope = config.get<string>('defaultScope', 'local');
    let scope: GitConfigScope;

    const hasWorkspace = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0;

    if (!hasWorkspace) {
      scope = 'global';
    } else {
      const scopePick = await vscode.window.showQuickPick(
        [
          { label: 'This Repository', description: 'Set git config for this repo only', value: 'local' as GitConfigScope },
          { label: 'Global', description: 'Set git config globally for all repos', value: 'global' as GitConfigScope },
        ],
        {
          placeHolder: 'Apply to...',
        }
      );
      if (!scopePick) {
        return;
      }
      scope = scopePick.value;
    }

    // Apply git config
    try {
      gitConfig.switchUser(profile, scope);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to set git config: ${message}`);
      return;
    }

    // Update remote URL if SSH is configured
    const autoSwitch = config.get<boolean>('autoSwitchRemote', true);
    if (autoSwitch && profile.sshHost && scope === 'local') {
      sshConfig.updateRemoteUrl(profile);
    }

    // Set active profile
    await profileManager.setActiveProfile(profileId);

    vscode.window.showInformationMessage(
      `Switched to "${profile.name}" (${scope}).`
    );
  });

  const showCurrentProfileCmd = vscode.commands.registerCommand('gitswitch.showCurrentProfile', () => {
    const active = profileManager.getActiveProfile();
    if (!active) {
      vscode.window.showInformationMessage('No active GitSwitch profile.');
      return;
    }

    const details = [
      `Profile: ${active.name}`,
      `Git User: ${active.gitUserName}`,
      `Git Email: ${active.gitEmail}`,
      active.sshHost ? `SSH Host: ${active.sshHost}` : null,
      active.sshKeyPath ? `SSH Key: ${active.sshKeyPath}` : null,
      active.useToken ? `Token: configured` : null,
    ]
      .filter(Boolean)
      .join('  |  ');

    vscode.window.showInformationMessage(details);
  });

  // --- Register disposables ---
  context.subscriptions.push(
    addProfileCmd,
    editProfileCmd,
    removeProfileCmd,
    switchProfileCmd,
    showCurrentProfileCmd,
    treeView,
    statusBar,
    treeProvider,
    profileManager,
    webview,
  );
}

export function deactivate() {}
