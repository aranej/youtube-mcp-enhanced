import { google, youtube_v3 } from 'googleapis';
import { PlaylistParams, PlaylistItemsParams, SearchParams } from '../types.js';
import { OAuthService } from './oauth.js';

// OAuth config from environment
const OAUTH_CLIENT_ID = process.env.YOUTUBE_OAUTH_CLIENT_ID || '';
const OAUTH_CLIENT_SECRET = process.env.YOUTUBE_OAUTH_CLIENT_SECRET || '';

/**
 * Service for interacting with YouTube playlists
 */
export class PlaylistService {
  private youtube: youtube_v3.Youtube | null = null;
  private youtubeAuth: youtube_v3.Youtube | null = null;
  private initialized = false;
  private oauthService: OAuthService | null = null;

  constructor() {
    // Don't initialize in constructor
  }

  /**
   * Initialize the YouTube client with API key (read-only)
   */
  private initialize() {
    if (this.initialized) return;
    
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      throw new Error('YOUTUBE_API_KEY environment variable is not set.');
    }

    this.youtube = google.youtube({
      version: "v3",
      auth: apiKey
    });
    
    this.initialized = true;
  }

  /**
   * Initialize OAuth service for write operations
   */
  private initializeOAuth() {
    if (this.oauthService) return this.oauthService;
    
    if (!OAUTH_CLIENT_ID || !OAUTH_CLIENT_SECRET) {
      throw new Error('YOUTUBE_OAUTH_CLIENT_ID and YOUTUBE_OAUTH_CLIENT_SECRET environment variables are required for write operations.');
    }

    this.oauthService = new OAuthService({
      clientId: OAUTH_CLIENT_ID,
      clientSecret: OAUTH_CLIENT_SECRET
    });

    return this.oauthService;
  }

  /**
   * Get authenticated YouTube client for write operations
   */
  private async getAuthenticatedYoutube(): Promise<youtube_v3.Youtube> {
    const oauth = this.initializeOAuth();
    const client = await oauth.getAuthenticatedClient();
    
    if (!client) {
      throw new Error('Not authenticated. Please run youtube_startAuth first.');
    }

    return google.youtube({
      version: 'v3',
      auth: client
    });
  }

  /**
   * Check if OAuth is configured and authenticated
   */
  isOAuthConfigured(): boolean {
    return !!(OAUTH_CLIENT_ID && OAUTH_CLIENT_SECRET);
  }

  /**
   * Check if we have valid OAuth credentials
   */
  hasValidCredentials(): boolean {
    try {
      const oauth = this.initializeOAuth();
      return oauth.hasValidCredentials();
    } catch {
      return false;
    }
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthUrl(): string {
    const oauth = this.initializeOAuth();
    return oauth.getAuthUrl();
  }

  /**
   * Start OAuth flow with local server
   */
  async startAuthFlow(): Promise<boolean> {
    const oauth = this.initializeOAuth();
    return oauth.authenticateWithBrowser();
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string): Promise<boolean> {
    const oauth = this.initializeOAuth();
    return oauth.exchangeCode(code);
  }

  /**
   * Create a new playlist
   */
  async createPlaylist({ 
    title, 
    description = '',
    privacyStatus = 'private'
  }: { 
    title: string; 
    description?: string;
    privacyStatus?: 'private' | 'public' | 'unlisted';
  }): Promise<unknown> {
    try {
      const youtube = await this.getAuthenticatedYoutube();
      
      const response = await youtube.playlists.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title,
            description
          },
          status: {
            privacyStatus
          }
        }
      });
      
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create playlist: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Add a video to a playlist
   */
  async addToPlaylist({ 
    playlistId, 
    videoId,
    position
  }: { 
    playlistId: string; 
    videoId: string;
    position?: number;
  }): Promise<unknown> {
    try {
      const youtube = await this.getAuthenticatedYoutube();
      
      const requestBody: any = {
        snippet: {
          playlistId,
          resourceId: {
            kind: 'youtube#video',
            videoId
          }
        }
      };

      if (position !== undefined) {
        requestBody.snippet.position = position;
      }
      
      const response = await youtube.playlistItems.insert({
        part: ['snippet'],
        requestBody
      });
      
      return response.data;
    } catch (error) {
      throw new Error(`Failed to add video to playlist: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Add multiple videos to a playlist
   */
  async addVideosToPlaylist({ 
    playlistId, 
    videoIds
  }: { 
    playlistId: string; 
    videoIds: string[];
  }): Promise<{ success: string[]; failed: { videoId: string; error: string }[] }> {
    const results = {
      success: [] as string[],
      failed: [] as { videoId: string; error: string }[]
    };

    for (const videoId of videoIds) {
      try {
        await this.addToPlaylist({ playlistId, videoId });
        results.success.push(videoId);
      } catch (error) {
        results.failed.push({
          videoId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }

  // ============ READ OPERATIONS (API Key) ============

  /**
   * Get information about a YouTube playlist
   */
  async getPlaylist({ 
    playlistId 
  }: PlaylistParams): Promise<unknown> {
    try {
      this.initialize();
      
      const response = await this.youtube!.playlists.list({
        part: ['snippet', 'contentDetails'],
        id: [playlistId]
      });
      
      return response.data.items?.[0] || null;
    } catch (error) {
      throw new Error(`Failed to get playlist: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get videos in a YouTube playlist
   */
  async getPlaylistItems({ 
    playlistId, 
    maxResults = 50 
  }: PlaylistItemsParams): Promise<unknown[]> {
    try {
      this.initialize();
      
      const response = await this.youtube!.playlistItems.list({
        part: ['snippet', 'contentDetails'],
        playlistId,
        maxResults
      });
      
      return response.data.items || [];
    } catch (error) {
      throw new Error(`Failed to get playlist items: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Search for playlists on YouTube
   */
  async searchPlaylists({ 
    query, 
    maxResults = 10 
  }: SearchParams): Promise<unknown[]> {
    try {
      this.initialize();
      
      const response = await this.youtube!.search.list({
        part: ['snippet'],
        q: query,
        maxResults,
        type: ['playlist']
      });
      
      return response.data.items || [];
    } catch (error) {
      throw new Error(`Failed to search playlists: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
