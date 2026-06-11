import { GitConfigScope, GitUser, Profile } from '../types';
import { GitUtil } from './GitUtil';

export class GitConfigService {
  /**
   * Read the current git identity for the given scope.
   * For local scope, `repoRoot` must be the resolved repository root.
   */
  getCurrentUser(scope: GitConfigScope, repoRoot?: string): GitUser {
    const flag = scope === 'local' ? '--local' : '--global';
    const cwd = scope === 'local' ? repoRoot : undefined;

    return {
      name: this.getConfigValue('user.name', flag, cwd),
      email: this.getConfigValue('user.email', flag, cwd),
    };
  }

  /**
   * Apply a profile's identity to git config.
   * For local scope a resolved `repoRoot` is required; passing none throws.
   */
  switchUser(profile: Profile, scope: GitConfigScope, repoRoot?: string): void {
    const flag = scope === 'local' ? '--local' : '--global';

    if (scope === 'local' && !repoRoot) {
      throw new Error('No git repository found in the current workspace. Open a repository to set local git config.');
    }

    const cwd = scope === 'local' ? repoRoot : undefined;
    this.setConfigValue('user.name', profile.gitUserName, flag, cwd);
    this.setConfigValue('user.email', profile.gitEmail, flag, cwd);
  }

  private getConfigValue(key: string, flag: string, cwd?: string): string | undefined {
    // `--get` returns only the last value for multi-valued keys (single line).
    const value = GitUtil.tryRun(['config', flag, '--get', key], cwd);
    return value && value.length > 0 ? value : undefined;
  }

  private setConfigValue(key: string, value: string, flag: string, cwd?: string): void {
    // Argument array — no shell — so values with quotes/`$`/`;` are safe.
    GitUtil.run(['config', flag, key, value], cwd);
  }
}
