# Legacy `src/functions` Inventory

`src/functions` was a dead legacy source tree. It was not imported by the active MCP server, build entry points, README examples, docs, or scripts. The active first-class runtime remains `src/server-utils.ts` plus `src/services/*`.

The removed tree used an older decorator-style `MCPFunction`/`MCPFunctionGroup` model and contained runtime problems that should not be carried forward as source code: stale SDK imports, missing `google` imports in several files, dependencies that are not part of the active package, fragile download/transcode assumptions, direct filesystem writes, and OAuth/write paths without a current safety design.

## Harvestable Ideas

### Already Covered By Active Services

- Basic video lookup, video search, channel lookup, channel videos, playlist lookup, playlist items, transcript retrieval, transcript search, and timestamped transcript formatting are represented in the active service layer or server registrations.
- These ideas do not need the legacy implementation preserved.

### Transcript And Content Analysis

- Transcript-first video summaries with configurable output length.
- Sentiment analysis over full transcript text plus sentence/segment sentiment.
- Entity/topic extraction from transcripts.
- Key-moment timestamp generation from transcript segments and transition phrases.
- Recommendation ranking by combining related videos, topic IDs, category, and extracted transcript topics.

Dirty `src/functions/analysis.ts` note: the local working copy had already replaced the old `youtube-transcript` calls with the active `fetchYouTubeTranscript` helper. The harvestable idea is therefore the direction of reusing the current transcript fetcher for analysis workflows, not the legacy decorator implementation.

Any implementation of this area needs a separate proposal for NLP provider choice, credentials, quota/cost limits, long-transcript chunking, output schemas, privacy handling, and failure behavior.

### Channel And Video Analytics

- Channel growth trend analysis across periods such as 7, 30, 90, and 365 days.
- Video-level performance metrics combining YouTube Data API statistics with YouTube Analytics metrics.
- Simple forecasting for views, engagement, milestones, and confidence factors.
- Retention-style summaries, peak engagement points, and watch-time trend analysis.

This requires a separate YouTube Analytics/OAuth design. The old code assumes analytics APIs and owner-authenticated metrics without defining scopes, token storage, permission boundaries, metric availability, or validation of the forecasting math.

### Playlist Intelligence

- Smart playlist creation from source videos, optional target duration, and tags.
- Playlist order optimization by engagement, duration, views, or relevance.
- Video suggestions from related videos plus topic, tag, and title overlap.
- Playlist-level summary metrics such as total views, average engagement, duration spread, and relevance score.

This requires a separate write-operation design for OAuth scopes, dry-run behavior, idempotency, batch limits, quota handling, error recovery, and safe user confirmation.

### Captions, Translation, And Localization

- Caption upload and translation while preserving SRT timing structure.
- Caption quality analysis using lexical complexity, reading speed, and word count.
- Metadata translation for titles, descriptions, and tags.
- Spoken-language detection for whole captions and segmented caption text.

This requires a separate design for caption write permissions, Google Translate or alternate provider credentials, temporary file handling, privacy, language fallback behavior, and quota/cost controls.

### Downloads, Shorts, And Media Generation

- Download options discovery for video and audio formats.
- Video/audio download and conversion.
- Frame extraction for thumbnails.
- Shorts creation from video segments with simple visual effects.
- Segment discovery from timestamped/high-engagement comments.
- Hook generation and hook-performance analysis from Shorts patterns.
- Programmatic thumbnail generation and thumbnail A/B scheduling ideas.

This requires a separate media/storage safety proposal before implementation: filesystem boundaries, cleanup, background job behavior, ffmpeg/runtime dependencies, copyright and YouTube terms considerations, OAuth upload flow, path validation, and limits on file size and duration.

## Non-Goals For This Cleanup

- Do not reconnect the decorator model to the MCP server.
- Do not add missing media, NLP, or translation dependencies just to keep legacy code compiling.
- Do not rewrite active OAuth, video, transcript, playlist, or channel services as part of this archival cleanup.
- Treat these notes as backlog inventory only; new runtime work should start from `src/server-utils.ts` and `src/services/*`.
