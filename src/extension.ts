import * as vscode from 'vscode';
import { ProfileManager } from './services/ProfileManager';
import { GitConfigService } from './services/GitConfigService';
import { SSHConfigService } from './services/SSHConfigService';
import { CredentialHelperService } from './services/CredentialHelperService';
import { TokenManager } from './services/TokenManager';
import { StatusBarManager } from './ui/StatusBarManager';
import { ProfileSidebarViewProvider } from './ui/ProfileSidebarView';
import { ProfileWebview } from './ui/ProfileWebview';
import { GitConfigScope, Profile, AuthMethod, resolveAuthMethod } from './types';

export function activate(context: vscode.ExtensionContext) {
  const profileManager = new ProfileManager(context);
  const gitConfig = new GitConfigService();
  const sshConfig = new SSHConfigService();
  const credentialHelper = new CredentialHelperService();
  const tokenManager = new TokenManager(context);
  const statusBar = new StatusBarManager(profileManager);
  const sidebarProvider = new ProfileSidebarViewProvider(context.extensionUri, profileManager);

  const sidebarView = vscode.window.registerWebviewViewProvider(
    ProfileSidebarViewProvider.viewType,
    sidebarProvider
  );

  // --- Webview helper ---
  const webview = new ProfileWebview(
    context.extensionUri,
    sshConfig,
    async (data, existingId) => {
      const method = (data.authMethod || 'none') as AuthMethod;
      const profileData = {
        name: data.name,
        gitUserName: data.gitUserName,
        gitEmail: data.gitEmail,
        authMethod: method,
        sshKeyPath: method === 'ssh' ? (data.sshKeyPath || undefined) : undefined,
        sshHost: method === 'ssh' ? (data.sshHost || undefined) : undefined,
        useToken: method === 'https',
        avatarUrl: data.avatarUrl || undefined,
      };

      if (existingId) {
        await profileManager.updateProfile(existingId, profileData);

        if (method === 'https' && data.token) {
          await tokenManager.storeToken(existingId, data.token);
        } else if (method !== 'https') {
          await tokenManager.deleteToken(existingId);
        }

        const profile = profileManager.getProfile(existingId);
        if (profile && method === 'ssh' && profile.sshKeyPath && profile.sshHost) {
          sshConfig.addHostEntry(profile);
        }

        vscode.window.showInformationMessage(`Profile "${data.name}" updated.`);
      } else {
        const profile = await profileManager.addProfile(profileData);

        if (method === 'https' && data.token) {
          await tokenManager.storeToken(profile.id, data.token);
        }

        if (method === 'ssh' && profile.sshKeyPath && profile.sshHost) {
          sshConfig.addHostEntry(profile);
        }

        vscode.window.showInformationMessage(`Profile "${data.name}" created.`);
      }
    }
  );

  // --- Commands ---

  const addProfileCmd = vscode.commands.registerCommand('gitflip.addProfile', () => {
    webview.show();
  });

  const editProfileCmd = vscode.commands.registerCommand('gitflip.editProfile', async (arg?: unknown) => {
    let profileId: string | undefined;

    if (typeof arg === 'string') {
      profileId = arg;
    } else if (arg && typeof arg === 'object' && 'profile' in (arg as Record<string, unknown>)) {
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

    const method = resolveAuthMethod(profile);
    const existingToken = method === 'https' ? await tokenManager.getToken(profileId) : undefined;
    webview.show(profile, existingToken);
  });

  const removeProfileCmd = vscode.commands.registerCommand('gitflip.removeProfile', async (arg?: unknown) => {
    let profileId: string | undefined;

    if (typeof arg === 'string') {
      profileId = arg;
    } else if (arg && typeof arg === 'object' && 'profile' in (arg as Record<string, unknown>)) {
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
      const method = resolveAuthMethod(profile);
      if (method === 'ssh' && profile.sshHost) {
        sshConfig.removeHostEntry(profile.sshHost);
      }
      if (method === 'https') {
        credentialHelper.rejectCredentials('github.com');
      }
      await tokenManager.deleteToken(profileId);
      await profileManager.removeProfile(profileId);
      vscode.window.showInformationMessage(`Profile "${profile.name}" removed.`);
    }
  });

  const switchProfileCmd = vscode.commands.registerCommand('gitflip.switchProfile', async (arg?: unknown) => {
    let profileId: string | undefined;

    if (typeof arg === 'string') {
      profileId = arg;
    } else if (arg && typeof arg === 'object' && 'profile' in (arg as Record<string, unknown>)) {
      profileId = ((arg as Record<string, unknown>).profile as { id: string }).id;
    }

    if (!profileId) {
      const profiles = profileManager.getProfiles();
      if (profiles.length === 0) {
        const action = await vscode.window.showInformationMessage(
          'No profiles yet. Would you like to create one?',
          'Add Profile'
        );
        if (action === 'Add Profile') {
          vscode.commands.executeCommand('gitflip.addProfile');
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
    const config = vscode.workspace.getConfiguration('gitflip');
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

    // Auth-method-specific actions
    const autoSwitch = config.get<boolean>('autoSwitchRemote', true);
    const method = resolveAuthMethod(profile);

    if (method === 'ssh') {
      if (autoSwitch && profile.sshHost && scope === 'local') {
        sshConfig.updateRemoteUrl(profile);
      }
    } else if (method === 'https') {
      const token = await tokenManager.getToken(profileId);
      if (token) {
        credentialHelper.ensureCredentialHelper();
        credentialHelper.setCredentials('github.com', profile.gitUserName, token);
      } else {
        vscode.window.showWarningMessage(
          `No token configured for "${profile.name}". Push/pull may require authentication.`
        );
      }
      if (autoSwitch && scope === 'local') {
        credentialHelper.convertRemoteToHttps();
      }
    }

    // Set active profile
    await profileManager.setActiveProfile(profileId);

    vscode.window.showInformationMessage(
      `Switched to "${profile.name}" (${scope}).`
    );
  });

  const duplicateProfileCmd = vscode.commands.registerCommand('gitflip.duplicateProfile', async (arg?: unknown) => {
    let profileId: string | undefined;

    if (typeof arg === 'string') {
      profileId = arg;
    } else if (arg && typeof arg === 'object' && 'profile' in (arg as Record<string, unknown>)) {
      profileId = ((arg as Record<string, unknown>).profile as { id: string }).id;
    }

    if (!profileId) {
      const profiles = profileManager.getProfiles();
      if (profiles.length === 0) {
        vscode.window.showInformationMessage('No profiles to duplicate.');
        return;
      }

      const picked = await vscode.window.showQuickPick(
        profiles.map(p => ({ label: p.name, description: `${p.gitUserName} <${p.gitEmail}>`, id: p.id })),
        { placeHolder: 'Select a profile to duplicate' }
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

    // Open the webview pre-filled with the source profile's data but as a new profile
    const sourceToken = resolveAuthMethod(profile) === 'https' ? await tokenManager.getToken(profileId) : undefined;
    const duplicate: Profile = {
      ...profile,
      id: '', // will be ignored — show() without existingId triggers addProfile
      name: `${profile.name} (Copy)`,
    };
    webview.show(duplicate, sourceToken ?? undefined);
  });

  const showCurrentProfileCmd = vscode.commands.registerCommand('gitflip.showCurrentProfile', () => {
    const active = profileManager.getActiveProfile();
    if (!active) {
      vscode.window.showInformationMessage('No active GitFlip profile.');
      return;
    }

    const method = resolveAuthMethod(active);
    const details = [
      `Profile: ${active.name}`,
      `Git User: ${active.gitUserName}`,
      `Git Email: ${active.gitEmail}`,
      method === 'ssh' && active.sshHost ? `SSH Host: ${active.sshHost}` : null,
      method === 'ssh' && active.sshKeyPath ? `SSH Key: ${active.sshKeyPath}` : null,
      method === 'https' ? `Auth: HTTPS (Token)` : null,
      method === 'none' ? `Auth: Git Config Only` : null,
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
    duplicateProfileCmd,
    showCurrentProfileCmd,
    sidebarView,
    statusBar,
    sidebarProvider,
    profileManager,
    webview,
  );
}

export function deactivate() {}
