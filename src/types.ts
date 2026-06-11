export type AuthMethod = 'ssh' | 'https' | 'none';

export interface Profile {
  id: string;
  name: string;
  gitUserName: string;
  gitEmail: string;
  authMethod?: AuthMethod;
  sshKeyPath?: string;
  sshHost?: string;
  useToken?: boolean;
  avatarUrl?: string; // URL or data URI for profile avatar
}

/** Infer auth method for legacy profiles that lack the authMethod field. */
export function resolveAuthMethod(profile: Profile): AuthMethod {
  if (profile.authMethod) {
    return profile.authMethod;
  }
  if (profile.sshKeyPath || profile.sshHost) {
    return 'ssh';
  }
  if (profile.useToken) {
    return 'https';
  }
  return 'none';
}

export type GitConfigScope = 'local' | 'global';

export interface GitUser {
  name: string | undefined;
  email: string | undefined;
}

/** Data submitted from the profile editor webview before it becomes a Profile. */
export interface ProfileInput {
  name: string;
  gitUserName: string;
  gitEmail: string;
  authMethod: AuthMethod;
  sshKeyPath?: string;
  sshHost?: string;
  token?: string;
  avatarUrl?: string;
}

/**
 * Validate a profile submission. Returns an array of human-readable error
 * messages; an empty array means the input is valid.
 */
export function validateProfileInput(input: ProfileInput): string[] {
  const errors: string[] = [];

  if (!input.name.trim()) {
    errors.push('Profile name is required.');
  }
  if (!input.gitUserName.trim()) {
    errors.push('Git user name is required.');
  }
  if (!input.gitEmail.trim()) {
    errors.push('Git email is required.');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.gitEmail.trim())) {
    errors.push('Git email does not look like a valid email address.');
  }

  if (input.authMethod === 'ssh') {
    if (!input.sshKeyPath?.trim()) {
      errors.push('SSH key path is required for SSH authentication.');
    }
    if (!input.sshHost?.trim()) {
      errors.push('SSH host alias is required for SSH authentication.');
    } else if (!/^[A-Za-z0-9._-]+$/.test(input.sshHost.trim())) {
      errors.push('SSH host alias may only contain letters, numbers, dots, dashes and underscores.');
    }
  }

  if (input.avatarUrl?.trim()) {
    if (!isSafeAvatarUrl(input.avatarUrl.trim())) {
      errors.push('Avatar must be an https:// URL or an uploaded image.');
    }
  }

  return errors;
}

/**
 * Only allow avatar sources that are safe to embed in a webview <img src>:
 * https URLs and base64 image data URIs. Rejects javascript:, file:, http:, etc.
 */
export function isSafeAvatarUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.startsWith('https://')) {
    return true;
  }
  if (/^data:image\/(png|jpeg|gif|svg\+xml|webp);base64,/i.test(trimmed)) {
    return true;
  }
  return false;
}
