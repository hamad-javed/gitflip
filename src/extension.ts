import * as vscode from 'vscode';
import { ProfileManager } from './services/ProfileManager';
import { GitConfigService } from './services/GitConfigService';
import { SSHConfigService } from './services/SSHConfigService';
import { CredentialHelperService } from './services/CredentialHelperService';
import { TokenManager } from './services/TokenManager';
import { GitHubService } from './services/GitHubService';
import { GitUtil } from './services/GitUtil';
import { StatusBarManager } from './ui/StatusBarManager';
import { ProfileSidebarViewProvider } from './ui/ProfileSidebarView';
import { ProfileWebview } from './ui/ProfileWebview';
import {
  GitConfigScope,
  Profile,
  AuthMethod,
  ProfileInput,
  resolveAuthMethod,
  validateProfileInput,
} from './types';

export function activate(context: vscode.ExtensionContext) {
  const profileManager = new ProfileManager(context);
  const gitConfig = new GitConfigService();
  const sshConfig = new SSHConfigService();
  const credentialHelper = new CredentialHelperService();
  const tokenManager = new TokenManager(context);
  const gitHub = new GitHubService();
  const statusBar = new StatusBarManager(profileManager, gitConfig);
  const sidebarProvider = new ProfileSidebarViewProvider(context.extensionUri, profileManager);

  const sidebarView = vscode.window.registerWebviewViewProvider(
    ProfileSidebarViewProvider.viewType,
    sidebarProvider
  );

  // Resolve a command argument (string id, tree-item, or webview message) to a profile id.
  function argToProfileId(arg: unknown): string | undefined {
    if (typeof arg === 'string') {
      return arg || undefined;
    }
    if (arg && typeof arg === 'object' && 'profile' in (arg as Record<string, unknown>)) {
      const inner = (arg as Record<string, unknown>).profile;
      if (inner && typeof inner === 'object' && 'id' in (inner as Record<string, unknown>)) {
        return (inner as { id: string }).id;
      }
    }
    return undefined;
  }

  // Let the user pick a profile when no explicit argument was supplied.
  async function pickProfile(placeHolder: string, emptyMessage: string): Promise<string | undefined> {
    const profiles = profileManager.getProfiles();
    if (profiles.length === 0) {
      vscode.window.showInformationMessage(emptyMessage);
      return undefined;
    }
    const activeId = profileManager.getActiveProfileId();
    const picked = await vscode.window.showQuickPick(
      profiles.map(p => ({
        label: `${p.id === activeId ? '$(check) ' : ''}${p.name}`,
        description: `${p.gitUserName} <${p.gitEmail}>`,
        id: p.id,
      })),
      { placeHolder }
    );
    return picked?.id;
  }

  // --- Webview save handler (shared by Add / Edit / Duplicate) ---
  const webview = new ProfileWebview(
    sshConfig,
    async (data, existingId) => {
      const method = (data.authMethod || 'none') as AuthMethod;
      const input: ProfileInput = {
        name: data.name.trim(),
        gitUserName: data.gitUserName.trim(),
        gitEmail: data.gitEmail.trim(),
        authMethod: method,
        sshKeyPath: method === 'ssh' ? data.sshKeyPath?.trim() || undefined : undefined,
        sshHost: method === 'ssh' ? data.sshHost?.trim() || undefined : undefined,
        token: method === 'https' ? data.token : undefined,
        avatarUrl: data.avatarUrl?.trim() || undefined,
      };

      const errors = validateProfileInput(input);
      if (errors.length > 0) {
        vscode.window.showErrorMessage(`Cannot save profile: ${errors.join(' ')}`);
        return; // Leave the editor open so the user can correct the input.
      }

      // For HTTPS profiles, verify the token against the GitHub API before
      // saving so a bad/expired token (or a username/account mismatch) is
      // caught now rather than on the next push. The check is best-effort:
      // network failures and mismatches warn but let the user proceed.
      if (method === 'https' && input.token) {
        const proceed = await confirmToken(gitHub, input.token, input.gitUserName);
        if (!proceed) {
          return; // Leave the editor open so the user can fix the token.
        }
      }

      const profileData: Omit<Profile, 'id'> = {
        name: input.name,
        gitUserName: input.gitUserName,
        gitEmail: input.gitEmail,
        authMethod: method,
        sshKeyPath: input.sshKeyPath,
        sshHost: input.sshHost,
        useToken: method === 'https',
        avatarUrl: input.avatarUrl,
      };

      try {
        if (existingId) {
          await profileManager.updateProfile(existingId, profileData);

          if (method === 'https' && input.token) {
            await tokenManager.storeToken(existingId, input.token);
          } else if (method !== 'https') {
            await tokenManager.deleteToken(existingId);
          }

          if (method === 'ssh' && input.sshKeyPath && input.sshHost) {
            sshConfig.addHostEntry({ ...profileData, id: existingId });
          }
          vscode.window.showInformationMessage(`Profile "${input.name}" updated.`);
        } else {
          const profile = await profileManager.addProfile(profileData);

          if (method === 'https' && input.token) {
            await tokenManager.storeToken(profile.id, input.token);
          }
          if (method === 'ssh' && input.sshKeyPath && input.sshHost) {
            sshConfig.addHostEntry(profile);
          }
          vscode.window.showInformationMessage(`Profile "${input.name}" created.`);
        }
        webview.close();
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to save profile: ${errMessage(err)}`);
      }
    }
  );

  // --- Commands ---

  const addProfileCmd = vscode.commands.registerCommand('gitflip.addProfile', () => {
    webview.show();
  });

  const editProfileCmd = vscode.commands.registerCommand('gitflip.editProfile', async (arg?: unknown) => {
    let profileId = argToProfileId(arg);
    if (!profileId) {
      profileId = await pickProfile('Select a profile to edit', 'No profiles yet. Add one first.');
    }
    if (!profileId) {
      return;
    }

    const profile = profileManager.getProfile(profileId);
    if (!profile) {
      vscode.window.showErrorMessage('That profile no longer exists.');
      return;
    }

    const method = resolveAuthMethod(profile);
    const existingToken = method === 'https' ? await tokenManager.getToken(profileId) : undefined;
    webview.show(profile, existingToken);
  });

  const removeProfileCmd = vscode.commands.registerCommand('gitflip.removeProfile', async (arg?: unknown) => {
    let profileId = argToProfileId(arg);
    if (!profileId) {
      profileId = await pickProfile('Select a profile to remove', 'No profiles to remove.');
    }
    if (!profileId) {
      return;
    }

    const profile = profileManager.getProfile(profileId);
    if (!profile) {
      return;
    }

    const confirm = await vscode.window.showWarningMessage(
      `Remove profile "${profile.name}"? This deletes its stored token and SSH config entry.`,
      { modal: true },
      'Remove'
    );
    if (confirm !== 'Remove') {
      return;
    }

    try {
      const method = resolveAuthMethod(profile);
      if (method === 'ssh' && profile.sshHost) {
        sshConfig.removeHostEntry(profile.sshHost);
      }
      await tokenManager.deleteToken(profileId);
      await profileManager.removeProfile(profileId);
      vscode.window.showInformationMessage(`Profile "${profile.name}" removed.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to remove profile: ${errMessage(err)}`);
    }
  });

  const switchProfileCmd = vscode.commands.registerCommand('gitflip.switchProfile', async (arg?: unknown) => {
    if (!GitUtil.isGitAvailable()) {
      vscode.window.showErrorMessage('Git is not installed or not on your PATH. Install Git and reload the window.');
      return;
    }

    let profileId = argToProfileId(arg);
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
      profileId = await pickProfile('Switch to profile...', 'No profiles yet.');
    }
    if (!profileId) {
      return;
    }

    const profile = profileManager.getProfile(profileId);
    if (!profile) {
      vscode.window.showErrorMessage('That profile no longer exists.');
      return;
    }

    const config = vscode.workspace.getConfiguration('gitflip');
    const defaultScope = config.get<GitConfigScope>('defaultScope', 'local');
    const repoRoot = GitUtil.resolveRepoRoot();

    // Decide scope. Local requires a real git repository.
    let scope: GitConfigScope;
    if (!repoRoot) {
      scope = 'global';
    } else {
      const scopePick = await vscode.window.showQuickPick(
        [
          { label: 'This Repository', description: repoRoot, value: 'local' as GitConfigScope },
          { label: 'Global', description: 'Apply to all repositories', value: 'global' as GitConfigScope },
        ],
        {
          placeHolder: `Apply "${profile.name}" to... (default: ${defaultScope})`,
        }
      );
      if (!scopePick) {
        return;
      }
      scope = scopePick.value;
    }

    // 1. Apply git identity.
    try {
      gitConfig.switchUser(profile, scope, repoRoot);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to set git config: ${errMessage(err)}`);
      return;
    }

    // 2. Auth-method-specific actions (local scope only — they touch one repo).
    const autoSwitch = config.get<boolean>('autoSwitchRemote', true);
    const method = resolveAuthMethod(profile);
    const notes: string[] = [];

    try {
      if (method === 'ssh' && scope === 'local' && repoRoot) {
        if (profile.sshKeyPath && profile.sshHost) {
          sshConfig.addHostEntry(profile); // Ensure the host block exists.
        }
        if (autoSwitch && profile.sshHost) {
          const changed = sshConfig.updateRemoteUrl(profile, repoRoot);
          if (changed) {
            notes.push('remote switched to SSH');
          }
        }
      } else if (method === 'https') {
        const token = await tokenManager.getToken(profileId);
        if (scope === 'local' && repoRoot) {
          if (token) {
            credentialHelper.applyToRepo(repoRoot, 'github.com', profile.gitUserName, token);
          }
          if (autoSwitch) {
            const changed = credentialHelper.convertRemoteToHttps(repoRoot, profile.gitUserName);
            if (changed) {
              notes.push('remote switched to HTTPS');
            }
          }
        }
        if (!token) {
          vscode.window.showWarningMessage(
            `No token stored for "${profile.name}". Edit the profile to add a Personal Access Token, or push/pull will prompt for credentials.`
          );
        }
      }
    } catch (err) {
      // Identity is already set; surface auth issues without rolling back.
      vscode.window.showWarningMessage(`Git identity set, but auth setup had an issue: ${errMessage(err)}`);
    }

    await profileManager.setActiveProfile(profileId);

    const suffix = notes.length > 0 ? ` — ${notes.join(', ')}` : '';
    vscode.window.showInformationMessage(`Switched to "${profile.name}" (${scope})${suffix}.`);
  });

  const duplicateProfileCmd = vscode.commands.registerCommand('gitflip.duplicateProfile', async (arg?: unknown) => {
    let profileId = argToProfileId(arg);
    if (!profileId) {
      profileId = await pickProfile('Select a profile to duplicate', 'No profiles to duplicate.');
    }
    if (!profileId) {
      return;
    }

    const profile = profileManager.getProfile(profileId);
    if (!profile) {
      return;
    }

    const sourceToken = resolveAuthMethod(profile) === 'https'
      ? await tokenManager.getToken(profileId)
      : undefined;

    // Empty id → the webview treats this as a new profile on save.
    const duplicate: Profile = { ...profile, id: '', name: `${profile.name} (Copy)` };
    webview.show(duplicate, sourceToken);
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
      method === 'https' ? 'Auth: HTTPS (Token)' : null,
      method === 'none' ? 'Auth: Git Config Only' : null,
    ]
      .filter(Boolean)
      .join('  |  ');

    vscode.window.showInformationMessage(details);
  });

  const checkRepoCmd = vscode.commands.registerCommand('gitflip.checkRepo', async () => {
    if (!GitUtil.isGitAvailable()) {
      vscode.window.showErrorMessage('Git is not installed or not on your PATH.');
      return;
    }

    const repoRoot = GitUtil.resolveRepoRoot();
    if (!repoRoot) {
      vscode.window.showInformationMessage('No git repository in the current workspace.');
      return;
    }

    const actual = gitConfig.getCurrentUser('local', repoRoot);
    const active = profileManager.getActiveProfile();
    const where = `Repo: ${repoRoot}\nName: ${actual.name ?? '(unset)'}\nEmail: ${actual.email ?? '(unset)'}`;

    if (!active) {
      vscode.window.showInformationMessage(`No active GitFlip profile.\n${where}`, { modal: true });
      return;
    }

    const matches =
      (actual.email ?? '').toLowerCase() === active.gitEmail.trim().toLowerCase() &&
      (actual.name ?? '') === active.gitUserName.trim();

    if (matches) {
      vscode.window.showInformationMessage(`This repo matches "${active.name}".\n${where}`, { modal: true });
      return;
    }

    const choice = await vscode.window.showWarningMessage(
      `This repo's git identity does not match the active profile "${active.name}".\n\n${where}\n\nProfile: ${active.gitUserName} <${active.gitEmail}>`,
      { modal: true },
      'Switch to Profile'
    );
    if (choice === 'Switch to Profile') {
      vscode.commands.executeCommand('gitflip.switchProfile', active.id);
    }
  });

  context.subscriptions.push(
    addProfileCmd,
    editProfileCmd,
    removeProfileCmd,
    switchProfileCmd,
    duplicateProfileCmd,
    showCurrentProfileCmd,
    checkRepoCmd,
    sidebarView,
    statusBar,
    sidebarProvider,
    profileManager,
    webview,
  );
}

/**
 * Validate a PAT against GitHub and, on any problem, ask the user whether to
 * save anyway. Returns true if the save should proceed.
 *
 * Runs behind a progress notification because it makes a network call. A valid
 * token whose account login differs from the profile's git username is allowed
 * (the two are independent on GitHub) but the mismatch is pointed out.
 */
async function confirmToken(
  gitHub: GitHubService,
  token: string,
  gitUserName: string
): Promise<boolean> {
  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'GitFlip: verifying token…' },
    () => gitHub.validateToken(token)
  );

  if (result.ok) {
    if (result.login && result.login.toLowerCase() !== gitUserName.trim().toLowerCase()) {
      const choice = await vscode.window.showWarningMessage(
        `Token is valid for GitHub account "${result.login}", but this profile's git user name is "${gitUserName}". Save anyway?`,
        { modal: true },
        'Save Anyway'
      );
      return choice === 'Save Anyway';
    }
    return true;
  }

  const choice = await vscode.window.showWarningMessage(
    `Token check failed: ${result.reason ?? 'unknown error'} Save the profile anyway?`,
    { modal: true },
    'Save Anyway'
  );
  return choice === 'Save Anyway';
}

/** Extract a human-readable message from an unknown thrown value. */
function errMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

export function deactivate() {}
