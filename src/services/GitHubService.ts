import * as https from 'https';

/** Result of validating a Personal Access Token against the GitHub API. */
export interface TokenValidation {
  ok: boolean;
  /** The authenticated account's login, when the token is valid. */
  login?: string;
  /** A human-readable reason when the token is not usable. */
  reason?: string;
}

/**
 * Talks to the GitHub REST API. Used to confirm that a Personal Access Token
 * is valid before a profile relies on it, so a bad or expired token surfaces
 * immediately instead of on the next push.
 */
export class GitHubService {
  /**
   * Validate a token by calling `GET /user`. Returns the authenticated login
   * on success, or a reason on failure. Network errors resolve to a failure
   * rather than throwing, so callers can warn without aborting the save.
   */
  async validateToken(token: string, host = 'github.com'): Promise<TokenValidation> {
    const trimmed = token.trim();
    if (!trimmed) {
      return { ok: false, reason: 'Token is empty.' };
    }

    // github.com uses api.github.com; GitHub Enterprise uses <host>/api/v3.
    const apiHost = host === 'github.com' ? 'api.github.com' : host;
    const apiPath = host === 'github.com' ? '/user' : '/api/v3/user';

    try {
      const res = await this.request(apiHost, apiPath, trimmed);
      if (res.status === 200) {
        const login = this.parseLogin(res.body);
        return { ok: true, login };
      }
      if (res.status === 401) {
        return { ok: false, reason: 'Token is invalid or has expired.' };
      }
      if (res.status === 403) {
        return { ok: false, reason: 'Token is forbidden (check its scopes or rate limit).' };
      }
      return { ok: false, reason: `GitHub returned HTTP ${res.status}.` };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: `Could not reach GitHub: ${message}` };
    }
  }

  private parseLogin(body: string): string | undefined {
    try {
      const data = JSON.parse(body) as { login?: unknown };
      return typeof data.login === 'string' ? data.login : undefined;
    } catch {
      return undefined;
    }
  }

  private request(
    apiHost: string,
    apiPath: string,
    token: string
  ): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: apiHost,
          path: apiPath,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'User-Agent': 'GitFlip-VSCode',
            Accept: 'application/vnd.github+json',
          },
          timeout: 10_000,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => {
            body += chunk;
          });
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
        }
      );

      req.on('timeout', () => req.destroy(new Error('request timed out')));
      req.on('error', reject);
      req.end();
    });
  }
}
