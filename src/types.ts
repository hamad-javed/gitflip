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
