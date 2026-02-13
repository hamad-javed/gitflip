# GitFlip

Manage and switch between multiple GitHub accounts in VS Code — git config, SSH keys, personal access tokens, and profile avatars.

## Features

- **Profile Management** — Create profiles for each GitHub account with git user name, email, SSH key, PAT, and avatar
- **One-Click Switching** — Switch between profiles from the status bar, command palette, or sidebar
- **Inline CRUD Actions** — Edit, duplicate, and delete profiles directly from the sidebar with always-visible action buttons
- **Profile Avatars** — Upload an image or paste a GitHub avatar URL for each profile
- **Git Config** — Automatically sets `user.name` and `user.email` (per-repo or global)
- **SSH Key Management** — Manages `~/.ssh/config` host aliases and updates remote URLs
- **Token Storage** — Securely stores GitHub PATs using VS Code's encrypted secret storage
- **Webview Sidebar** — Rich profile cards with avatars, auth badges (SSH/Token), active indicator, and inline actions
- **Status Bar** — Shows the active profile at a glance; click to switch

## Getting Started

1. Install the extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=hamad-javed.gitflip)
2. Open the command palette (`Cmd+Shift+P`) and run **GitFlip: Add Profile**
3. Fill in your GitHub account details and optionally add an avatar
4. Switch profiles from the status bar or the GitFlip sidebar

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
| `gitflip.autoSwitchRemote` | `true` | Auto-update remote URL to match SSH host alias |

## Sidebar

The GitFlip sidebar displays all your profiles as rich cards with:

- **Profile avatar** — custom image or default icon
- **Active badge** — green border and "Active" label for the current profile
- **Auth badges** — SSH and Token indicators
- **Inline actions** — Switch, Edit, Duplicate, and Delete buttons on every card

## How It Works

### Git Config
When you switch profiles, GitFlip runs `git config user.name` and `git config user.email` with the selected profile's values. You choose whether to apply this to the current repository (local) or globally.

### SSH Keys
If a profile has an SSH key and host alias configured, GitFlip adds an entry to `~/.ssh/config`:

```
Host github-work
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_work
  IdentitiesOnly yes
```

When switching profiles with `autoSwitchRemote` enabled, the repository's remote URL is updated to use the correct host alias (e.g., `git@github-work:user/repo.git`).

### Token Storage
Personal Access Tokens are stored using VS Code's `SecretStorage` API, which encrypts them using the OS keychain.

### Profile Avatars
Avatars can be set via file upload (PNG, JPG, GIF, SVG, WebP) or by pasting a URL (e.g., your GitHub avatar URL). Uploaded images are stored as data URIs alongside the profile.

## Author

**Hamad Javed** — [GitHub](https://github.com/hamad-javed)

## License

MIT
