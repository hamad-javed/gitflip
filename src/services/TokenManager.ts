import * as vscode from 'vscode';

const TOKEN_PREFIX = 'gitflip.token.';

export class TokenManager {
  constructor(private context: vscode.ExtensionContext) {}

  async storeToken(profileId: string, token: string): Promise<void> {
    await this.context.secrets.store(`${TOKEN_PREFIX}${profileId}`, token);
  }

  async getToken(profileId: string): Promise<string | undefined> {
    return this.context.secrets.get(`${TOKEN_PREFIX}${profileId}`);
  }

  async deleteToken(profileId: string): Promise<void> {
    await this.context.secrets.delete(`${TOKEN_PREFIX}${profileId}`);
  }

  async hasToken(profileId: string): Promise<boolean> {
    const token = await this.getToken(profileId);
    return token !== undefined && token.length > 0;
  }
}
