import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { Profile } from '../types';

const PROFILES_KEY = 'gitswitch.profiles';
const ACTIVE_PROFILE_KEY = 'gitswitch.activeProfileId';

export class ProfileManager {
  private onDidChangeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.onDidChangeEmitter.event;

  constructor(private context: vscode.ExtensionContext) {}

  getProfiles(): Profile[] {
    return this.context.globalState.get<Profile[]>(PROFILES_KEY, []);
  }

  async addProfile(profile: Omit<Profile, 'id'>): Promise<Profile> {
    const profiles = this.getProfiles();
    const newProfile: Profile = {
      ...profile,
      id: crypto.randomUUID(),
    };
    profiles.push(newProfile);
    await this.context.globalState.update(PROFILES_KEY, profiles);
    this.onDidChangeEmitter.fire();
    return newProfile;
  }

  async updateProfile(id: string, updates: Partial<Omit<Profile, 'id'>>): Promise<Profile | undefined> {
    const profiles = this.getProfiles();
    const index = profiles.findIndex(p => p.id === id);
    if (index === -1) {
      return undefined;
    }
    profiles[index] = { ...profiles[index], ...updates };
    await this.context.globalState.update(PROFILES_KEY, profiles);
    this.onDidChangeEmitter.fire();
    return profiles[index];
  }

  async removeProfile(id: string): Promise<boolean> {
    const profiles = this.getProfiles();
    const filtered = profiles.filter(p => p.id !== id);
    if (filtered.length === profiles.length) {
      return false;
    }
    await this.context.globalState.update(PROFILES_KEY, filtered);

    // Clear active profile if we just removed it
    const activeId = this.getActiveProfileId();
    if (activeId === id) {
      await this.context.globalState.update(ACTIVE_PROFILE_KEY, undefined);
    }

    this.onDidChangeEmitter.fire();
    return true;
  }

  getProfile(id: string): Profile | undefined {
    return this.getProfiles().find(p => p.id === id);
  }

  getActiveProfileId(): string | undefined {
    return this.context.globalState.get<string>(ACTIVE_PROFILE_KEY);
  }

  getActiveProfile(): Profile | undefined {
    const id = this.getActiveProfileId();
    if (!id) {
      return undefined;
    }
    return this.getProfile(id);
  }

  async setActiveProfile(id: string): Promise<void> {
    await this.context.globalState.update(ACTIVE_PROFILE_KEY, id);
    this.onDidChangeEmitter.fire();
  }

  dispose(): void {
    this.onDidChangeEmitter.dispose();
  }
}
