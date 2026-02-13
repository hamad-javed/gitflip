export interface Profile {
  id: string;
  name: string;
  gitUserName: string;
  gitEmail: string;
  sshKeyPath?: string;
  sshHost?: string;
  useToken?: boolean;
  avatarUrl?: string; // URL or data URI for profile avatar
}

export type GitConfigScope = 'local' | 'global';

export interface GitUser {
  name: string | undefined;
  email: string | undefined;
}
