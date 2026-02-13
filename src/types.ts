export interface Profile {
  id: string;
  name: string;
  gitUserName: string;
  gitEmail: string;
  sshKeyPath?: string;
  sshHost?: string;
  useToken?: boolean;
}

export type GitConfigScope = 'local' | 'global';

export interface GitUser {
  name: string | undefined;
  email: string | undefined;
}
