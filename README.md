# GitFlip

Manage and switch between multiple GitHub accounts in VS Code — choose HTTPS, SSH, or git config only. No SSH setup required.

## Features

- **Auth Method Selector** — Choose how each profile authenticates: HTTPS (PAT), SSH key, or just git config
- **HTTPS Mode** — Use a Personal Access Token with git credential helpers. No SSH setup needed — perfect for beginners
- **SSH Mode** — Full SSH key management with `~/.ssh/config` host aliases and automatic remote URL switching
- **Git Config Only** — Just switch `user.name` and `user.email` without any auth configuration
- **Profile Management** — Create profiles for each GitHub account with name, email, auth method, and avatar
- **One-Click Switching** — Switch between profiles from the status bar, command palette, or sidebar
- **Inline CRUD Actions** — Edit, duplicate, and delete profiles directly from the sidebar
- **Profile Avatars** — Upload an image or paste a GitHub avatar URL for each profile
- **Token Storage** — Securely stores GitHub PATs using VS Code's encrypted secret storage
- **Webview Sidebar** — Rich profile cards with avatars, auth badges (SSH/HTTPS), active indicator, and inline actions
- **Status Bar** — Shows the active profile at a glance; click to switch

## Getting Started

1. Install the extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=hamad-javed.gitflip)
2. Open the command palette (`Cmd+Shift+P`) and run **GitFlip: Add Profile**
3. Fill in your GitHub account details
4. Choose an authentication method:
   - **Git Config Only** — Just set user.name and email
   - **HTTPS (Token)** — Enter a GitHub PAT for push/pull authentication
   - **SSH Key** — Select an SSH key and host alias
5. Switch profiles from the status bar or the GitFlip sidebar

## Authentication Methods

### HTTPS (Personal Access Token)

The easiest way to get started. GitFlip stores your PAT securely and configures git's credential helper automatically when you switch profiles.

1. Create a [GitHub Personal Access Token](https://github.com/settings/tokens)
2. Add a profile in GitFlip and select **HTTPS (Personal Access Token)**
3. Paste your token — it's encrypted using your OS keychain
4. When you switch to this profile, GitFlip sets your git config and configures the credential helper so push/pull works immediately

### SSH Key

For advanced users who prefer SSH authentication. GitFlip manages `~/.ssh/config` entries and updates remote URLs automatically.

1. Add a profile and select **SSH Key**
2. Browse for your SSH private key and set a host alias
3. GitFlip adds the entry to `~/.ssh/config` and rewrites remote URLs when you switch

### Git Config Only

Just switches `user.name` and `user.email` — no authentication setup. Useful when you only need to change the commit author identity.

## Commands

| Command | Description |
|---|---|
| `GitFlip: Add Profile` | Create a new GitHub account profile |
| `GitFlip: Switch Profile` | Switch to a different profile |
| `GitFlip: Edit Profile` | Edit an existing profile |
| `GitFlip: Remove Profile` | Delete a profile |
| `GitFlip: Duplicate Profile` | Duplicate an existing profile |
| `GitFlip: Show Current Profile` | Display the active profile details |

## Settings

| Setting | Default | Description |
|---|---|---|
| `gitflip.defaultScope` | `local` | Default git config scope (`local` or `global`) |
| `gitflip.autoSwitchRemote` | `true` | Auto-update remote URL format (SSH host alias or HTTPS) when switching profiles |

## Sidebar

The GitFlip sidebar displays all your profiles as rich cards with:

- **Profile avatar** — custom image or default icon
- **Active badge** — green border and "Active" label for the current profile
- **Auth badges** — SSH or HTTPS indicator
- **Inline actions** — Switch, Edit, Duplicate, and Delete buttons on every card

## How It Works

### Git Config
When you switch profiles, GitFlip runs `git config user.name` and `git config user.email` with the selected profile's values. You choose whether to apply this to the current repository (local) or globally.

### HTTPS Credentials
For HTTPS profiles, GitFlip uses `git credential approve` to feed your PAT into the system's credential helper (macOS Keychain, Windows Credential Manager, or `git-credential-store`). When switching away, old credentials are cleared with `git credential reject`. If no credential helper is configured, GitFlip sets `credential.helper store` as a fallback.

### SSH Keys
For SSH profiles with a key and host alias, GitFlip adds an entry to `~/.ssh/config`:

```
Host github-work
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_work
  IdentitiesOnly yes
```

When switching with `autoSwitchRemote` enabled, the repository's remote URL is updated to match the auth method (e.g., `git@github-work:user/repo.git` for SSH, `https://github.com/user/repo.git` for HTTPS).

### Token Storage
Personal Access Tokens are stored using VS Code's `SecretStorage` API, which encrypts them using the OS keychain.

### Profile Avatars
Avatars can be set via file upload (PNG, JPG, GIF, SVG, WebP) or by pasting a URL (e.g., your GitHub avatar URL). Uploaded images are stored as data URIs alongside the profile.

## Author

**Hamad Javed** — [GitHub](https://github.com/hamad-javed)

## License

MIT
