import { GitUtil } from './GitUtil';
import { parseGitHubRemote } from './githubRemote';

// Re-exported for callers that imported it from here historically.
export { parseGitHubRemote };

/**
 * Manages HTTPS authentication for a repository.
 *
 * Strategy: instead of relying on a global credential store (which keys
 * credentials by host only and therefore cannot keep two GitHub accounts
 * working at once), GitFlip writes the username into the repository's `origin`
 * remote URL and enables `credential.useHttpPath`. Combined with a per-repo
 * credential entry keyed by username, this lets each repository authenticate
 * as a distinct account without clobbering global credentials.
 */
export class CredentialHelperService {
  /**
   * Ensure a credential helper is available so the token can be cached.
   * Sets the scope-appropriate fallback only when nothing is configured.
   */
  ensureCredentialHelper(repoRoot?: string): void {
    if (this.getConfiguredHelper(repoRoot)) {
      return;
    }
    // Prefer a repo-local helper so we never mutate the user's global config.
    if (repoRoot) {
      GitUtil.run(['config', '--local', 'credential.helper', 'store'], repoRoot);
    } else {
      GitUtil.run(['config', '--global', 'credential.helper', 'store']);
    }
  }

  /** Returns the effective credential helper, or undefined if none is set. */
  private getConfiguredHelper(repoRoot?: string): string | undefined {
    // `git config credential.helper` resolves global + local together when
    // run inside the repo; without a repo, only global applies.
    return GitUtil.tryRun(['config', '--get', 'credential.helper'], repoRoot);
  }

  /**
   * Configure the repository so that HTTPS push/pull authenticates as
   * `username` using `token`. Must be called with a real repo root.
   */
  applyToRepo(repoRoot: string, host: string, username: string, token: string): void {
    // Distinguish credentials by path so multiple accounts on the same host
    // don't collide in the credential store.
    GitUtil.run(['config', '--local', 'credential.useHttpPath', 'true'], repoRoot);
    this.ensureCredentialHelper(repoRoot);

    // Refresh the stored credential for this exact user/host.
    this.rejectCredentials(host, repoRoot);
    this.approveCredentials(host, username, token, repoRoot);
  }

  /** Feed a credential into the configured helper. */
  private approveCredentials(host: string, username: string, token: string, repoRoot?: string): void {
    const input = `protocol=https\nhost=${host}\nusername=${username}\npassword=${token}\n\n`;
    try {
      GitUtil.runWithInput(['credential', 'approve'], input, repoRoot);
    } catch {
      // A helper may reject `approve` without a prior fill; the URL-embedded
      // username plus useHttpPath still lets git prompt/cache correctly.
    }
  }

  /** Remove a cached credential for a host. Safe if none exists. */
  rejectCredentials(host: string, repoRoot?: string): void {
    const input = `protocol=https\nhost=${host}\n\n`;
    try {
      GitUtil.runWithInput(['credential', 'reject'], input, repoRoot);
    } catch {
      // Credential may not exist — that is fine.
    }
  }

  /**
   * Rewrite the repo's `origin` remote to HTTPS, embedding `username` so git
   * picks the right credential. Only touches github.com remotes.
   * Returns true if the remote was changed.
   */
  convertRemoteToHttps(repoRoot: string, username: string): boolean {
    const currentUrl = GitUtil.tryRun(['remote', 'get-url', 'origin'], repoRoot);
    if (!currentUrl) {
      return false;
    }

    const parsed = parseGitHubRemote(currentUrl);
    if (!parsed) {
      return false; // Not a github.com remote — leave it alone.
    }

    const encodedUser = encodeURIComponent(username);
    const newUrl = `https://${encodedUser}@github.com/${parsed.repoPath}`;
    if (newUrl === currentUrl) {
      return false;
    }

    GitUtil.run(['remote', 'set-url', 'origin', newUrl], repoRoot);
    return true;
  }
}
