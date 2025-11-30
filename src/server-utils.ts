import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { VideoService } from './services/video.js';
import { TranscriptService } from './services/transcript.js';
import { PlaylistService } from './services/playlist.js';
import { ChannelService } from './services/channel.js';

const packageVersion = '0.1.12';

/**
 * Creates and configures a YouTube MCP server with all tools, resources, and prompts registered
 */
export function createYouTubeMcpServer() {
    const server = new McpServer({
        name: 'youtube-mcp',
        version: packageVersion,
    }, {
        capabilities: {
            resources: {},
            prompts: {},
            tools: {},
        }
    });

    const videoService = new VideoService();
    const transcriptService = new TranscriptService();
    const playlistService = new PlaylistService();
    const channelService = new ChannelService();

    // Register static resource for Smithery discovery
    server.registerResource(
        'info',
        'youtube://info',
        {
            title: 'YouTube MCP Server Information',
            description: 'Information about available YouTube MCP resources and how to use them',
            mimeType: 'application/json',
        },
        async (uri) => ({
            contents: [{
                uri: uri.href,
                text: JSON.stringify({
                    message: "YouTube MCP Server Resources",
                    availableResources: {
                        transcripts: {
                            description: "Access YouTube video transcripts",
                            uriPattern: "youtube://transcript/{videoId}",
                            example: "youtube://transcript/dQw4w9WgXcQ",
                            note: "Replace {videoId} with actual YouTube video ID"
                        }
                    },
                    tools: [
                        "videos_getVideo",
                        "videos_searchVideos",
                        "transcripts_getTranscript",
                        "channels_getChannel",
                        "channels_listVideos",
                        "playlists_getPlaylist",
                        "playlists_getPlaylistItems"
                    ],
                    prompts: [
                        "summarize-video",
                        "analyze-channel"
                    ]
                }, null, 2)
            }]
        })
    );

    // Register dynamic resource for transcripts
    server.registerResource(
        'transcript',
        new ResourceTemplate('youtube://transcript/{videoId}', { list: undefined }),
        {
            title: 'YouTube Video Transcript',
            description: 'Get the transcript for a YouTube video. Use URI format: youtube://transcript/{videoId}',
            mimeType: 'application/json',
        },
        async (uri, variables) => {
            const { videoId } = variables as unknown as { videoId: string };
            const result = await transcriptService.getTranscript({ videoId });
            return {
                contents: [{
                    uri: uri.href,
                    text: JSON.stringify(result, null, 2),
                    mimeType: "application/json"
                }]
            };
        }
    );

    // Register prompts
    server.registerPrompt(
        'summarize-video',
        {
            description: "Summarize a YouTube video",
            argsSchema: {
                videoId: z.string().describe("The ID of the video to summarize")
            }
        },
        ({ videoId }) => ({
            messages: [{
                role: 'user',
                content: {
                    type: 'text',
                    text: `Please get the transcript for video ID ${videoId} and summarize the key points.`
                }
            }]
        })
    );

    server.registerPrompt(
        'analyze-channel',
        {
            description: "Analyze a YouTube channel",
            argsSchema: {
                channelId: z.string().describe("The ID of the channel to analyze")
            }
        },
        ({ channelId }) => ({
            messages: [{
                role: 'user',
                content: {
                    type: 'text',
                    text: `Please analyze the channel with ID ${channelId}. Look at its recent videos, playlists, and statistics to provide an overview of its content strategy and performance.`
                }
            }]
        })
    );

    // Register video tools
    server.registerTool(
        'videos_getVideo',
        {
            title: 'Get Video Details',
            description: 'Get detailed information about a YouTube video including URL',
            annotations: { readOnlyHint: true, idempotentHint: true },
            inputSchema: {
                videoId: z.string().describe('The YouTube video ID'),
                parts: z.array(z.string()).optional().describe('Parts of the video to retrieve'),
            },
        },
        async ({ videoId, parts }) => {
            const result = await videoService.getVideo({ videoId, parts });
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    server.registerTool(
        'videos_searchVideos',
        {
            title: 'Search Videos',
            description: 'Search for videos on YouTube and return results with URLs',
            annotations: { readOnlyHint: true, idempotentHint: true },
            inputSchema: {
                query: z.string().describe('Search query'),
                maxResults: z.number().optional().describe('Maximum number of results to return'),
            },
        },
        async ({ query, maxResults }) => {
            const result = await videoService.searchVideos({ query, maxResults });
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    // Register transcript tool
    server.registerTool(
        'transcripts_getTranscript',
        {
            title: 'Get Video Transcript',
            description: 'Get the transcript of a YouTube video',
            annotations: { readOnlyHint: true, idempotentHint: true },
            inputSchema: {
                videoId: z.string().describe('The YouTube video ID'),
                language: z.string().optional().describe('Language code for the transcript'),
            },
        },
        async ({ videoId, language }) => {
            const result = await transcriptService.getTranscript({ videoId, language });
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    // Register channel tools
    server.registerTool(
        'channels_getChannel',
        {
            title: 'Get Channel Information',
            description: 'Get information about a YouTube channel',
            annotations: { readOnlyHint: true, idempotentHint: true },
            inputSchema: {
                channelId: z.string().describe('The YouTube channel ID'),
            },
        },
        async ({ channelId }) => {
            const result = await channelService.getChannel({ channelId });
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    server.registerTool(
        'channels_listVideos',
        {
            title: 'List Channel Videos',
            description: 'Get videos from a specific channel',
            annotations: { readOnlyHint: true, idempotentHint: true },
            inputSchema: {
                channelId: z.string().describe('The YouTube channel ID'),
                maxResults: z.number().optional().describe('Maximum number of results to return'),
            },
        },
        async ({ channelId, maxResults }) => {
            const result = await channelService.listVideos({ channelId, maxResults });
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    // Register playlist tools
    server.registerTool(
        'playlists_getPlaylist',
        {
            title: 'Get Playlist Information',
            description: 'Get information about a YouTube playlist',
            annotations: { readOnlyHint: true, idempotentHint: true },
            inputSchema: {
                playlistId: z.string().describe('The YouTube playlist ID'),
            },
        },
        async ({ playlistId }) => {
            const result = await playlistService.getPlaylist({ playlistId });
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    server.registerTool(
        'playlists_getPlaylistItems',
        {
            title: 'Get Playlist Items',
            description: 'Get videos in a YouTube playlist',
            annotations: { readOnlyHint: true, idempotentHint: true },
            inputSchema: {
                playlistId: z.string().describe('The YouTube playlist ID'),
                maxResults: z.number().optional().describe('Maximum number of results to return'),
            },
        },
        async ({ playlistId, maxResults }) => {
            const result = await playlistService.getPlaylistItems({ playlistId, maxResults });
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
    );

    // ============ WRITE OPERATIONS (OAuth required) ============

    server.registerTool(
        'youtube_checkAuth',
        {
            title: 'Check YouTube Authentication',
            description: 'Check if OAuth is configured and we have valid credentials for write operations',
            annotations: { readOnlyHint: true, idempotentHint: true },
            inputSchema: {},
        },
        async () => {
            const isConfigured = playlistService.isOAuthConfigured();
            const hasCredentials = playlistService.hasValidCredentials();
            
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        oauthConfigured: isConfigured,
                        hasValidCredentials: hasCredentials,
                        message: !isConfigured 
                            ? 'OAuth not configured. Set YOUTUBE_OAUTH_CLIENT_ID and YOUTUBE_OAUTH_CLIENT_SECRET environment variables.'
                            : !hasCredentials 
                                ? 'OAuth configured but not authenticated. Use youtube_getAuthUrl to get authorization URL.'
                                : 'Ready for write operations!'
                    }, null, 2)
                }]
            };
        }
    );

    server.registerTool(
        'youtube_getAuthUrl',
        {
            title: 'Get YouTube OAuth URL',
            description: 'Get the OAuth authorization URL. User needs to visit this URL to authorize the app.',
            annotations: { readOnlyHint: true, idempotentHint: true },
            inputSchema: {},
        },
        async () => {
            try {
                const authUrl = playlistService.getAuthUrl();
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            authUrl,
                            instructions: 'Visit this URL in your browser to authorize. After authorization, the page will show a success message.'
                        }, null, 2)
                    }]
                };
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            error: error instanceof Error ? error.message : String(error)
                        }, null, 2)
                    }]
                };
            }
        }
    );

    server.registerTool(
        'youtube_startAuth',
        {
            title: 'Start YouTube OAuth Flow',
            description: 'Start OAuth authentication flow. Opens a local server and waits for callback.',
            annotations: { readOnlyHint: false, idempotentHint: false },
            inputSchema: {},
        },
        async () => {
            try {
                const authUrl = playlistService.getAuthUrl();
                // Start auth flow in background
                const authPromise = playlistService.startAuthFlow();
                
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            status: 'waiting',
                            authUrl,
                            instructions: 'Visit this URL in your browser and authorize the app. The server is listening on http://localhost:8888/callback'
                        }, null, 2)
                    }]
                };
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            error: error instanceof Error ? error.message : String(error)
                        }, null, 2)
                    }]
                };
            }
        }
    );

    server.registerTool(
        'playlists_create',
        {
            title: 'Create Playlist',
            description: 'Create a new YouTube playlist (requires OAuth authentication)',
            annotations: { readOnlyHint: false, idempotentHint: false },
            inputSchema: {
                title: z.string().describe('The playlist title'),
                description: z.string().optional().describe('The playlist description'),
                privacyStatus: z.enum(['private', 'public', 'unlisted']).optional().describe('Privacy status (default: private)'),
            },
        },
        async ({ title, description, privacyStatus }) => {
            try {
                const result = await playlistService.createPlaylist({ 
                    title, 
                    description: description || '', 
                    privacyStatus: privacyStatus || 'private' 
                });
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            error: error instanceof Error ? error.message : String(error)
                        }, null, 2)
                    }]
                };
            }
        }
    );

    server.registerTool(
        'playlists_addVideo',
        {
            title: 'Add Video to Playlist',
            description: 'Add a video to a YouTube playlist (requires OAuth authentication)',
            annotations: { readOnlyHint: false, idempotentHint: false },
            inputSchema: {
                playlistId: z.string().describe('The playlist ID'),
                videoId: z.string().describe('The video ID to add'),
                position: z.number().optional().describe('Position in playlist (0-indexed)'),
            },
        },
        async ({ playlistId, videoId, position }) => {
            try {
                const result = await playlistService.addToPlaylist({ playlistId, videoId, position });
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            error: error instanceof Error ? error.message : String(error)
                        }, null, 2)
                    }]
                };
            }
        }
    );

    server.registerTool(
        'playlists_addVideos',
        {
            title: 'Add Multiple Videos to Playlist',
            description: 'Add multiple videos to a YouTube playlist (requires OAuth authentication)',
            annotations: { readOnlyHint: false, idempotentHint: false },
            inputSchema: {
                playlistId: z.string().describe('The playlist ID'),
                videoIds: z.array(z.string()).describe('Array of video IDs to add'),
            },
        },
        async ({ playlistId, videoIds }) => {
            try {
                const result = await playlistService.addVideosToPlaylist({ playlistId, videoIds });
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }]
                };
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            error: error instanceof Error ? error.message : String(error)
                        }, null, 2)
                    }]
                };
            }
        }
    );

    return server;
}