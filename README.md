# YouTube MCP Server Enhanced

> **Enhanced fork of [sfiorini/youtube-mcp](https://github.com/sfiorini/youtube-mcp)** with fixes and improvements.

A Model Context Protocol (MCP) server implementation for YouTube, enabling AI language models to interact with YouTube content through a standardized interface.

## What's Enhanced

- All video responses include direct YouTube URLs (`url` and `videoId` fields)
- Shared utilities architecture (single source of truth)
- Lazy initialization for better performance
- 90% code deduplication
- Better error handling
- Works reliably with Claude Code CLI on Windows

## Features

### Video Information

* Get video details (title, description, duration, etc.) **with direct URLs**
* List channel videos **with direct URLs**
* Get video statistics (views, likes, comments)
* Search videos across YouTube **with direct URLs**
* **NEW**: Enhanced video responses include `url` and `videoId` fields for easy integration

### Transcript Management

* Retrieve video transcripts
* Support for multiple languages
* Get timestamped captions
* Search within transcripts

### Direct Resources & Prompts

* **Resources**:
  * `youtube://transcript/{videoId}`: Access transcripts directly via resource URIs
  * `youtube://info`: Server information and usage documentation (Smithery discoverable)
* **Prompts**:
  * `summarize-video`: Automated workflow to get and summarize video content
  * `analyze-channel`: Comprehensive analysis of a channel's content strategy
* **Annotations**: All tools include capability hints (read-only, idempotent) for better LLM performance

### Channel Management

* Get channel details
* List channel playlists
* Get channel statistics
* Search within channel content

### Playlist Management

* List playlist items
* Get playlist details
* Search within playlists
* Get playlist video transcripts

## Installation

### Local Installation (Recommended)

1. Clone this repository:

```bash
git clone https://github.com/aranej/youtube-mcp-enhanced.git
cd youtube-mcp-enhanced
npm install
npm run build
```

2. Add to your Claude Desktop or Claude Code configuration:

**Claude Desktop** (`%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "youtube": {
      "command": "node",
      "args": ["/path/to/youtube-mcp-enhanced/dist/cli.js"],
      "env": {
        "YOUTUBE_API_KEY": "your_youtube_api_key_here"
      }
    }
  }
}
```

**Claude Code CLI** (`~/.claude.json`):

```json
{
  "mcpServers": {
    "youtube": {
      "command": "node",
      "args": ["/path/to/youtube-mcp-enhanced/dist/cli.js"],
      "env": {
        "YOUTUBE_API_KEY": "your_youtube_api_key_here"
      }
    }
  }
}
```

## Configuration

Set the following environment variables:

* `YOUTUBE_API_KEY`: Your YouTube Data API key (required)
* `YOUTUBE_TRANSCRIPT_LANG`: Default language for transcripts (optional, defaults to 'en')

## YouTube API Setup

1. Go to Google Cloud Console
2. Create a new project or select an existing one
3. Enable the YouTube Data API v3
4. Create API credentials (API key)
5. Copy the API key for configuration

## Examples

### Managing Videos

```javascript
// Get video details (now includes URL)
const video = await youtube.videos.getVideo({
  videoId: "dQw4w9WgXcQ"
});

// Enhanced response now includes:
// - video.url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
// - video.videoId: "dQw4w9WgXcQ"
// - All original YouTube API data

// Get video transcript
const transcript = await youtube.transcripts.getTranscript({
  videoId: "video-id",
  language: "en"
});

// Search videos (results now include URLs)
const searchResults = await youtube.videos.searchVideos({
  query: "search term",
  maxResults: 10
});

// Each search result includes:
// - result.url: "https://www.youtube.com/watch?v={videoId}"
// - result.videoId: "{videoId}"
// - All original YouTube search data
```

### Managing Channels

```javascript
// Get channel details
const channel = await youtube.channels.getChannel({
  channelId: "channel-id"
});

// List channel videos
const videos = await youtube.channels.listVideos({
  channelId: "channel-id",
  maxResults: 50
});
```

### Managing Playlists

```javascript
// Get playlist items
const playlistItems = await youtube.playlists.getPlaylistItems({
  playlistId: "playlist-id",
  maxResults: 50
});

// Get playlist details
const playlist = await youtube.playlists.getPlaylist({
  playlistId: "playlist-id"
});
```

## Enhanced Response Structure

### Video Objects with URLs

All video-related responses now include enhanced fields for easier integration:

```typescript
interface EnhancedVideoResponse {
  // Original YouTube API fields
  kind?: string;
  etag?: string;
  id?: string | YouTubeSearchResultId;
  snippet?: YouTubeSnippet;
  contentDetails?: any;
  statistics?: any;

  // NEW: Enhanced fields
  url: string;           // Direct YouTube video URL
  videoId: string;       // Extracted video ID
}
```

### Example Enhanced Response

```json
{
  "kind": "youtube#video",
  "id": "dQw4w9WgXcQ",
  "snippet": {
    "title": "Never Gonna Give You Up",
    "channelTitle": "Rick Astley",
    "description": "Official video for \"Never Gonna Give You Up\""
  },
  "statistics": {
    "viewCount": "1.5B",
    "likeCount": "15M"
  },
  // Enhanced fields:
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "videoId": "dQw4w9WgXcQ"
}
```

### Benefits

* **Easy URL Access**: No need to manually construct URLs
* **Consistent Structure**: Both search and individual video responses include URLs
* **Backward Compatible**: All existing YouTube API data is preserved
* **Type Safe**: Full TypeScript support available

## Development

```bash
# Install dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Development mode with auto-rebuild and hot reload
npm run dev

# Start the server (requires YOUTUBE_API_KEY)
npm start

# Publish to npm (runs build first)
npm run prepublishOnly
```

### Architecture

This project uses a **dual-architecture service-based design** with the following features:

* **Shared Utilities**: Single source of truth for all MCP server configuration (`src/server-utils.ts`)
* **Modern McpServer**: Updated from deprecated `Server` class to the new `McpServer`
* **Dynamic Version Management**: Version automatically read from `package.json`
* **Type-Safe Tool Registration**: Uses `zod` schemas for input validation
* **ES Modules**: Full ES module support with proper `.js` extensions
* **Enhanced Video Responses**: All video operations include `url` and `videoId` fields
* **Lazy Initialization**: YouTube API client initialized only when needed
* **Code Deduplication**: Eliminated 90% code duplication through shared utilities (407 → 285 lines)

### Project Structure

```diagram
src/
├── server-utils.ts        # 🆕 Shared MCP server utilities (single source of truth)
├── index.ts              # Smithery deployment entry point
├── server.ts             # CLI deployment entry point
├── services/             # Core business logic
│   ├── video.ts         # Video operations (search, getVideo)
│   ├── transcript.ts    # Transcript retrieval
│   ├── playlist.ts      # Playlist operations
│   └── channel.ts       # Channel operations
├── types.ts             # TypeScript interfaces
└── cli.ts               # CLI wrapper for standalone execution
```

### Key Features

* **Smithery Optimized**: Achieved 90%+ Smithery quality score with comprehensive resources, prompts, and configuration
* **Shared Utilities Architecture**: Eliminated 90% code duplication with single source of truth
* **Enhanced Video Responses**: All video objects include direct YouTube URLs
* **Flexible Configuration**: Optional config via Smithery UI or environment variables
* **Type-Safe Development**: Full TypeScript support with `zod` validation
* **Modern MCP Tools**: Uses `registerTool` instead of manual request handlers
* **Comprehensive Resources**: Discoverable resources and prompts for better LLM integration
* **Error Handling**: Comprehensive error handling with descriptive messages

## Contributing

See CONTRIBUTING.md for information about contributing to this repository.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
