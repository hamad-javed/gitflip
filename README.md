# GitSwitch

Manage and switch between multiple GitHub accounts in VS Code — git config, SSH keys, and personal access tokens.

## Features

- **Profile Management** — Create profiles for each GitHub account with git user name, email, SSH key, and PAT
- **One-Click Switching** — Switch between profiles from the status bar or command palette
- **Git Config** — Automatically sets `user.name` and `user.email` (per-repo or global)
- **SSH Key Management** — Manages `~/.ssh/config` host aliases and updates remote URLs
- **Token Storage** — Securely stores GitHub PATs using VS Code's encrypted secret storage
- **Sidebar View** — Tree view listing all profiles with the active one highlighted
- **Status Bar** — Shows the active profile at a glance; click to switch

## Getting Started

1. Install the extension
2. Open the command palette (`Cmd+Shift+P`) and run **GitSwitch: Add Profile**
3. Fill in your GitHub account details
4. Switch profiles from the status bar or the GitSwitch sidebar

## Commands

| Command | Description |
|---|---|
| `GitSwitch: Add Profile` | Create a new GitHub account profile |
| `GitSwitch: Switch Profile` | Switch to a different profile |
| `GitSwitch: Edit Profile` | Edit an existing profile |
| `GitSwitch: Remove Profile` | Delete a profile |
| `GitSwitch: Show Current Profile` | Display the active profile details |

## Settings

| Setting | Default | Description |
|---|---|---|
| `gitswitch.defaultScope` | `local` | Default git config scope (`local` or `global`) |
| `gitswitch.autoSwitchRemote` | `true` | Auto-update remote URL to match SSH host alias |

## How It Works

### Git Config
When you switch profiles, GitSwitch runs `git config user.name` and `git config user.email` with the selected profile's values. You choose whether to apply this to the current repository (local) or globally.

### SSH Keys
If a profile has an SSH key and host alias configured, GitSwitch adds an entry to `~/.ssh/config`:

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

## Author

**Hamad Javed** — [GitHub](https://github.com/hamad-javed)

## License

MIT
