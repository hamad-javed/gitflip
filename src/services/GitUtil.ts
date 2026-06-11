import { execFileSync } from 'child_process';
import * as vscode from 'vscode';

/**
 * Shared helpers for invoking git safely.
 *
 * All git invocations go through `execFileSync` with an argument array, so no
 * shell is involved and profile values (names, emails, URLs) cannot inject
 * shell commands regardless of their contents.
 */
export class GitUtil {
  private static gitAvailable: boolean | undefined;

  /** True if a `git` executable is on PATH. Result is cached after first check. */
  static isGitAvailable(): boolean {
    if (GitUtil.gitAvailable === undefined) {
      try {
        execFileSync('git', ['--version'], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
        GitUtil.gitAvailable = true;
      } catch {
        GitUtil.gitAvailable = false;
      }
    }
    return GitUtil.gitAvailable;
  }

  /** Throws a user-facing error if git is not installed. */
  static assertGitAvailable(): void {
    if (!GitUtil.isGitAvailable()) {
      throw new Error('Git is not installed or not on your PATH. Install Git and reload the window.');
    }
  }

  /**
   * Run git with the given arguments and return trimmed stdout.
   * Throws on non-zero exit; callers that expect failure should catch.
   */
  static run(args: string[], cwd?: string): string {
    GitUtil.assertGitAvailable();
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  }

  /**
   * Run git, feeding `input` to stdin. Used for `git credential` commands.
   */
  static runWithInput(args: string[], input: string, cwd?: string): string {
    GitUtil.assertGitAvailable();
    return execFileSync('git', args, {
      cwd,
      input,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  }

  /** Run git, returning undefined instead of throwing on failure. */
  static tryRun(args: string[], cwd?: string): string | undefined {
    try {
      return GitUtil.run(args, cwd);
    } catch {
      return undefined;
    }
  }

  /**
   * Resolve the git repository root for the user's current context.
   *
   * Prefers the repository containing the active editor's file (correct in
   * multi-root workspaces); falls back to scanning every workspace folder for
   * one that is inside a git work tree. Returns undefined if none is found.
   */
  static resolveRepoRoot(): string | undefined {
    if (!GitUtil.isGitAvailable()) {
      return undefined;
    }

    // 1. The folder containing the active file, if any.
    const activeUri = vscode.window.activeTextEditor?.document.uri;
    if (activeUri && activeUri.scheme === 'file') {
      const dir = activeUri.fsPath.replace(/[/\\][^/\\]*$/, '');
      const root = GitUtil.gitRoot(dir);
      if (root) {
        return root;
      }
    }

    // 2. Any workspace folder that lives inside a git work tree.
    const folders = vscode.workspace.workspaceFolders ?? [];
    for (const folder of folders) {
      const root = GitUtil.gitRoot(folder.uri.fsPath);
      if (root) {
        return root;
      }
    }

    return undefined;
  }

  /** Return the work-tree root for a directory, or undefined if not a repo. */
  private static gitRoot(dir: string): string | undefined {
    const insideWorkTree = GitUtil.tryRun(['rev-parse', '--is-inside-work-tree'], dir);
    if (insideWorkTree !== 'true') {
      return undefined;
    }
    return GitUtil.tryRun(['rev-parse', '--show-toplevel'], dir);
  }
}
