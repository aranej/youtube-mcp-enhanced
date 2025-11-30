import { google } from 'googleapis';
import * as http from 'http';
import * as url from 'url';
import * as fs from 'fs';
import * as path from 'path';

const TOKEN_PATH = path.join(process.env.APPDATA || process.env.HOME || '.', 'youtube-mcp-token.json');

const SCOPES = ['https://www.googleapis.com/auth/youtube'];

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
}

export class OAuthService {
  private oauth2Client;
  private config: OAuthConfig;

  constructor(config: OAuthConfig) {
    this.config = config;
    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri || 'http://localhost:8888/callback'
    );
  }

  /**
   * Get authenticated OAuth2 client
   */
  async getAuthenticatedClient() {
    // Try to load existing token
    const token = this.loadToken();
    if (token) {
      this.oauth2Client.setCredentials(token);
      
      // Check if token is expired and refresh if needed
      if (token.expiry_date && token.expiry_date < Date.now()) {
        try {
          const { credentials } = await this.oauth2Client.refreshAccessToken();
          this.saveToken(credentials);
          this.oauth2Client.setCredentials(credentials);
        } catch (error) {
          // Token refresh failed, need to re-authenticate
          console.error('Token refresh failed, need to re-authenticate');
          return null;
        }
      }
      
      return this.oauth2Client;
    }
    
    return null;
  }

  /**
   * Check if we have valid credentials
   */
  hasValidCredentials(): boolean {
    const token = this.loadToken();
    return token !== null;
  }

  /**
   * Get authorization URL for user to visit
   */
  getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    });
  }

  /**
   * Start local server and wait for OAuth callback
   */
  async authenticateWithBrowser(): Promise<boolean> {
    return new Promise((resolve) => {
      const server = http.createServer(async (req, res) => {
        try {
          const parsedUrl = url.parse(req.url || '', true);
          
          if (parsedUrl.pathname === '/callback') {
            const code = parsedUrl.query.code as string;
            
            if (code) {
              const { tokens } = await this.oauth2Client.getToken(code);
              this.oauth2Client.setCredentials(tokens);
              this.saveToken(tokens);
              
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end('<html><body><h1>Authorization successful!</h1><p>You can close this window and return to Claude.</p></body></html>');
              
              server.close();
              resolve(true);
            } else {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end('<html><body><h1>Authorization failed!</h1><p>No code received.</p></body></html>');
              
              server.close();
              resolve(false);
            }
          }
        } catch (error) {
          console.error('OAuth callback error:', error);
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Error!</h1><p>Something went wrong.</p></body></html>');
          
          server.close();
          resolve(false);
        }
      });

      server.listen(8888, () => {
        console.error(`OAuth server listening on http://localhost:8888`);
        console.error(`Please visit: ${this.getAuthUrl()}`);
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        server.close();
        resolve(false);
      }, 300000);
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string): Promise<boolean> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      this.saveToken(tokens);
      return true;
    } catch (error) {
      console.error('Failed to exchange code:', error);
      return false;
    }
  }

  private loadToken(): any {
    try {
      if (fs.existsSync(TOKEN_PATH)) {
        const content = fs.readFileSync(TOKEN_PATH, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('Failed to load token:', error);
    }
    return null;
  }

  private saveToken(token: any): void {
    try {
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
      console.error(`Token saved to ${TOKEN_PATH}`);
    } catch (error) {
      console.error('Failed to save token:', error);
    }
  }

  getOAuth2Client() {
    return this.oauth2Client;
  }
}
