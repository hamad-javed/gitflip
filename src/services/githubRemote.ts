/**
 * Parse a github.com remote (SSH or HTTPS, with or without an embedded
 * username) into its `owner/repo(.git)` path. Returns undefined for non-GitHub
 * remotes.
 *
 * Pure — no I/O — so it is directly testable. SSH host aliases are deliberately
 * NOT resolved here; SSHConfigService owns alias resolution because it can read
 * the alias's HostName from ~/.ssh/config.
 */
export function parseGitHubRemote(url: string): { repoPath: string } | undefined {
  // SSH form: git@github.com:owner/repo.git
  const sshGitHub = url.match(/^git@github\.com:(.+)$/);
  if (sshGitHub) {
    return { repoPath: sshGitHub[1] };
  }

  // HTTPS form: https://[user@]github.com/owner/repo(.git)
  const httpsGitHub = url.match(/^https:\/\/(?:[^@/]+@)?github\.com\/(.+)$/);
  if (httpsGitHub) {
    return { repoPath: httpsGitHub[1] };
  }

  // ssh:// form: ssh://git@github.com/owner/repo.git
  const sshProtoGitHub = url.match(/^ssh:\/\/git@github\.com\/(.+)$/);
  if (sshProtoGitHub) {
    return { repoPath: sshProtoGitHub[1] };
  }

  return undefined;
}
