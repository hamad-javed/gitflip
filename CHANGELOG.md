# Changelog

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
