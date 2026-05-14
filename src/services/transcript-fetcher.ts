import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

export interface TranscriptTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
  isTranslatable?: boolean;
}

export interface TranscriptFetchOptions {
  language?: string;
}

export interface TranscriptEntry {
  text: string;
  duration: number;
  offset: number;
  lang: string;
}

interface CaptionTracklistRenderer {
  captionTracks?: TranscriptTrack[];
  translationLanguages?: Array<{ languageCode: string }>;
}

const WATCH_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';
const RE_XML_TRANSCRIPT = /<text start="([^"]*)" dur="([^"]*)">([\s\S]*?)<\/text>/g;
const execFileAsync = promisify(execFile);
const YT_DLP_OPTIONS = {
  windowsHide: true,
  timeout: 120000,
  maxBuffer: 20 * 1024 * 1024,
} as const;

export async function fetchYouTubeTranscript(
  videoId: string,
  options: TranscriptFetchOptions = {},
): Promise<TranscriptEntry[]> {
  try {
    return await fetchTranscriptViaYtDlp(videoId, options.language);
  } catch {
    // Fall through to the lightweight web parser as a last resort.
  }

  try {
    const tracklist = await fetchCaptionTracklist(videoId, options.language);
    const track = selectTrack(tracklist, videoId, options.language);
    const transcriptUrl = buildTranscriptUrl(tracklist, track, options.language);
    const transcriptXml = await fetchText(transcriptUrl, options.language);
    const entries = parseTranscriptXml(transcriptXml, options.language ?? track.languageCode);

    if (entries.length) {
      return entries;
    }
  } catch (error) {
    throw new Error(`Failed to get transcript: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  throw new Error(`Failed to get transcript for video ${videoId}.`);
}

async function fetchCaptionTracklist(
  videoId: string,
  language?: string,
): Promise<CaptionTracklistRenderer> {
  const pageBody = await fetchText(`https://www.youtube.com/watch?v=${videoId}`, language);
  const playerResponse = extractInitialPlayerResponse(pageBody);
  const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer;

  if (!captions) {
    const status = playerResponse?.playabilityStatus?.status;
    const reason =
      playerResponse?.playabilityStatus?.reason ||
      playerResponse?.playabilityStatus?.errorScreen?.playerErrorMessageRenderer?.subreason?.simpleText;
    throw new Error(
      `Transcript metadata not available for video ${videoId}` +
        (status || reason ? ` (${status ?? 'UNKNOWN'}${reason ? `: ${reason}` : ''})` : '.'),
    );
  }

  return captions;
}

function selectTrack(
  tracklist: CaptionTracklistRenderer,
  videoId: string,
  language?: string,
): TranscriptTrack {
  const tracks = tracklist.captionTracks ?? [];

  if (!tracks.length) {
    throw new Error(`No caption tracks available for video ${videoId}.`);
  }

  if (!language) {
    return tracks[0];
  }

  const exactTrack = tracks.find((track) => track.languageCode === language);
  if (exactTrack) {
    return exactTrack;
  }

  const canTranslate = tracklist.translationLanguages?.some((item) => item.languageCode === language);
  if (canTranslate) {
    return tracks[0];
  }

  throw new Error(
    `Language '${language}' is not available for video ${videoId}. Available tracks: ${tracks
      .map((track) => track.languageCode)
      .join(', ')}`,
  );
}

function buildTranscriptUrl(
  tracklist: CaptionTracklistRenderer,
  track: TranscriptTrack,
  language?: string,
): string {
  const url = new URL(track.baseUrl);
  const exactTrackExists = !!language && (tracklist.captionTracks ?? []).some((item) => item.languageCode === language);

  if (language && !exactTrackExists) {
    url.searchParams.set('tlang', language);
  }

  url.searchParams.set('fmt', 'srv3');
  return url.toString();
}

function extractInitialPlayerResponse(pageBody: string): any {
  const marker = 'var ytInitialPlayerResponse = ';
  const startIndex = pageBody.indexOf(marker);

  if (startIndex === -1) {
    throw new Error('ytInitialPlayerResponse was not found in the YouTube watch page.');
  }

  const jsonStart = startIndex + marker.length;
  const jsonEnd = findJsonObjectEnd(pageBody, jsonStart);
  const jsonText = pageBody.slice(jsonStart, jsonEnd);

  return JSON.parse(jsonText);
}

function findJsonObjectEnd(text: string, startIndex: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return i + 1;
      }
    }
  }

  throw new Error('Could not determine the end of ytInitialPlayerResponse JSON.');
}

async function fetchText(url: string, language?: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': WATCH_USER_AGENT,
      ...(language ? { 'Accept-Language': language } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status} for ${url}`);
  }

  return response.text();
}

function parseTranscriptXml(xml: string, defaultLang: string): TranscriptEntry[] {
  return [...xml.matchAll(RE_XML_TRANSCRIPT)].map((match) => ({
    text: decodeXmlEntities(stripTags(match[3])),
    duration: Number.parseFloat(match[2]),
    offset: Number.parseFloat(match[1]),
    lang: defaultLang,
  }));
}

async function fetchTranscriptViaYtDlp(
  videoId: string,
  language?: string,
): Promise<TranscriptEntry[]> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'youtube-mcp-transcript-'));
  const requestedLanguage = language || 'en';

  try {
    let commandError: unknown;
    try {
      await runYtDlp([
        '--skip-download',
        '--write-auto-subs',
        '--write-subs',
        '--sub-langs',
        requestedLanguage,
        '--sub-format',
        'vtt',
        '--output',
        path.join(tempDir, '%(id)s.%(ext)s'),
        `https://youtu.be/${videoId}`,
      ]);
    } catch (error) {
      commandError = error;
    }

    const files = await fs.readdir(tempDir);
    const subtitleFile = files.find((file) => file.startsWith(`${videoId}.`) && file.endsWith(`.${requestedLanguage}.vtt`))
      || files.find((file) => file.startsWith(`${videoId}.`) && file.endsWith('.vtt'));

    if (!subtitleFile) {
      if (commandError) {
        throw commandError;
      }

      throw new Error(`yt-dlp did not produce a VTT subtitle file for video ${videoId}.`);
    }

    const vtt = await fs.readFile(path.join(tempDir, subtitleFile), 'utf8');
    const entries = parseVttTranscript(vtt, requestedLanguage);

    if (!entries.length) {
      throw new Error(`yt-dlp subtitle file was empty for video ${videoId}.`);
    }

    return entries;
  } catch (error) {
    throw new Error(`Failed to get transcript via yt-dlp: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function runYtDlp(args: string[]): Promise<void> {
  const projectRoot = process.cwd();
  const homeDir = process.env.HOME || '';
  const candidates = [
    { command: path.join(homeDir, '.local', 'bin', 'yt-dlp'), args },
    { command: path.join(projectRoot, '.venv', 'bin', 'yt-dlp'), args },
    { command: path.join(projectRoot, '.venv', 'Scripts', 'yt-dlp.exe'), args },
    { command: path.join(projectRoot, '.venv', 'bin', 'python'), args: ['-m', 'yt_dlp', ...args] },
    { command: path.join(projectRoot, '.venv', 'Scripts', 'python.exe'), args: ['-m', 'yt_dlp', ...args] },
    { command: 'yt-dlp', args },
    { command: 'py', args: ['-3', '-m', 'yt_dlp', ...args] },
    { command: 'python3', args: ['-m', 'yt_dlp', ...args] },
    { command: 'python', args: ['-m', 'yt_dlp', ...args] },
  ];

  let lastError: unknown = new Error('No yt-dlp command candidates were attempted.');

  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate.command, candidate.args, YT_DLP_OPTIONS);
      return;
    } catch (error) {
      lastError = error;

      if (!shouldTryNextYtDlpCandidate(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function shouldTryNextYtDlpCandidate(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as NodeJS.ErrnoException & { stderr?: string };
  const details = `${err.message}\n${err.stderr ?? ''}`;
  return err.code === 'ENOENT' || /No module named yt_dlp|not found/i.test(details);
}

function parseVttTranscript(vtt: string, defaultLang: string): TranscriptEntry[] {
  const normalized = vtt.replace(/\r/g, '');
  const blocks = normalized.split('\n\n');
  const entries: TranscriptEntry[] = [];
  let previousText = '';

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const timingLineIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingLineIndex === -1) {
      continue;
    }

    const [startRaw, endRaw] = lines[timingLineIndex].split('-->').map((part) => part.trim().split(' ')[0]);
    const text = decodeXmlEntities(
      stripTags(
        lines
          .slice(timingLineIndex + 1)
          .join(' ')
          .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, ' ')
          .replace(/<\/?c[^>]*>/g, ' '),
      ),
    )
      .replace(/\s+/g, ' ')
      .trim();

    if (!text || text === previousText) {
      continue;
    }

    const start = parseVttTimestamp(startRaw);
    const end = parseVttTimestamp(endRaw);

    entries.push({
      text,
      offset: start,
      duration: Math.max(end - start, 0),
      lang: defaultLang,
    });

    previousText = text;
  }

  return entries;
}

function parseVttTimestamp(value: string): number {
  const match = value.match(/(?:(\d{2}):)?(\d{2}):(\d{2})\.(\d{3})/);
  if (!match) {
    return 0;
  }

  const hours = Number.parseInt(match[1] || '0', 10);
  const minutes = Number.parseInt(match[2], 10);
  const seconds = Number.parseInt(match[3], 10);
  const milliseconds = Number.parseInt(match[4], 10);

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, '');
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}
