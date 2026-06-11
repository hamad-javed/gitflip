# Changelog

## 0.5.0

Feedback, drift detection, and a test suite.

- **Token validation** — When you save an HTTPS profile, GitFlip now verifies the Personal Access Token against the GitHub API before storing it. An invalid or expired token is caught immediately instead of on the next push, and a mismatch between the token's GitHub account and the profile's git user name is pointed out (you can still save anyway)
- **Identity drift in the status bar** — The status bar shows a warning state when the active repository's git email doesn't match the active profile, so you notice before committing with the wrong identity
- **`GitFlip: Check Current Repository` command** — Reports the repo's actual `user.name`/`user.email`, compares them to the active profile, and offers to switch if they differ
- **Test suite + CI** — Added unit tests (Node's built-in test runner) for profile validation, avatar-URL safety, auth-method inference, GitHub remote parsing, and SSH-config block parsing, plus a GitHub Actions workflow that runs typecheck, tests, and build on every push and PR. Run locally with `npm test`
- Extracted the GitHub-remote and SSH-config parsers into pure, dependency-free modules

## 0.4.0

Production-readiness release — correctness, security, and reliability fixes.

- **Multi-root aware switching** — Local git config now targets the repository containing the active file, not just the first workspace folder. Switching no longer writes to the wrong repo or silently fails when the first folder isn't a git repo
- **Shell-injection fixed** — All git invocations now use argument arrays instead of string interpolation, so profile names, emails, and URLs containing quotes, `$`, or `;` are handled safely
- **HTTPS multi-account fixed** — HTTPS profiles now embed the username in the repo's remote URL and enable `credential.useHttpPath`, so two GitHub accounts no longer overwrite each other in the credential store
- **SSH config no longer corrupted** — Rewrote the `~/.ssh/config` parser to work block-by-block; removal only ever touches GitFlip-managed entries and never damages neighbouring blocks. Writes are now atomic and preserve `0600` permissions
- **Per-repo credential clearing** — Removing an HTTPS profile no longer wipes credentials shared by other profiles
- **GitHub-only remote rewriting** — Remote URL conversion now verifies the remote points at GitHub before touching it; GitLab/Bitbucket/enterprise remotes are left alone
- **Webview hardening** — Added Content-Security-Policy and a script nonce to both webviews; avatar URLs are validated against an allowlist (https or image data URI only)
- **Input validation** — Profile name, email format, and SSH host alias are validated before saving
- **Git availability check** — A clear error is shown if `git` is not installed, instead of a cryptic failure
- **Type-checked builds** — `npm run typecheck` and `vsce package` now run a full TypeScript check
- Removed unused tree-view code

## 0.3.0

- **Auth method selector** — Choose between HTTPS (PAT), SSH, or Git Config Only when creating or editing a profile
- **HTTPS mode** — Manage accounts using just a Personal Access Token with git credential helpers. No SSH setup required
- **Git Config Only mode** — Switch user.name and email without any authentication configuration
- **Credential helper integration** — Automatically configures git credentials via `git credential approve/reject`
- **Auto remote URL conversion** — Converts remote URLs between SSH and HTTPS formats when switching profiles
- **Backward compatible** — Existing profiles are automatically detected as SSH, HTTPS, or config-only based on their settings
- **Updated sidebar badges** — Auth badges now show "SSH" or "HTTPS" instead of "SSH" and "Token"

## 0.2.0

- **Rebranded** from GitSwitch to GitFlip across the entire extension
- **Webview sidebar** — Replaced native tree view with a custom HTML/CSS sidebar for full layout control
- **Inline CRUD actions** — Edit, duplicate, and delete buttons always visible on each profile card
- **Profile avatars** — Upload an image from disk or paste a GitHub avatar URL
- **Duplicate profile** — New command to clone an existing profile as a starting point
- **Improved profile cards** — Avatars, active indicator with green dot/border, SSH/Token auth badges
- **Better icons** — Refined SVG icons for all action buttons with color-coded hover states

## 0.1.0

- Initial release
- Profile management (add, edit, remove)
- Git config switching (user.name, user.email) with local/global scope
- SSH config management (~/.ssh/config host aliases)
- Automatic remote URL switching for SSH profiles
- GitHub PAT storage via VS Code SecretStorage
- Status bar indicator with click-to-switch
- Sidebar tree view with all profiles
- Webview form for adding/editing profiles
