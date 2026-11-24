import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';

export interface ParsedFeedItem {
  guid: string;
  title: string;
  summary: string;
  body: string;
  link: string;
  publishedAt: string;
  category?: string;
  author?: string;
  contentHash: string;
}

function isPrivateOrBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (normalized.startsWith('::ffff:')) {
      const v4 = normalized.slice('::ffff:'.length);
      return isPrivateOrBlockedIp(v4);
    }
    return false;
  }
  return true;
}

export async function validateSafeExternalUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid feed URL format.');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only HTTP and HTTPS official source URLs are permitted.');
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost')
  ) {
    throw new Error('Local or internal hostnames are blocked for security.');
  }

  if (net.isIP(host)) {
    if (isPrivateOrBlockedIp(host)) {
      throw new Error('Private or loopback IP addresses are not permitted.');
    }
    return parsed;
  }

  const addresses = await dns.lookup(host, { all: true });
  if (!addresses.length) {
    throw new Error('Could not resolve external source host.');
  }
  for (const addr of addresses) {
    if (isPrivateOrBlockedIp(addr.address)) {
      throw new Error('Resolved host points to a restricted network range.');
    }
  }

  return parsed;
}

export function sanitizePublicLink(rawUrl: string | undefined): string {
  if (!rawUrl) return '';
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return '';
  }
  return '';
}

function stripTags(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(block: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = block.match(regex);
  return match ? stripTags(match[1]) : '';
}

export function parseFeedPayload(payloadText: string, fallbackBaseUrl = 'https://official-source.invalid'): ParsedFeedItem[] {
  const trimmed = payloadText.trim();
  const items: ParsedFeedItem[] = [];

  // JSON Feed 1.0 / 1.1 support
  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed) as {
        items?: Array<{
          id?: string;
          url?: string;
          title?: string;
          summary?: string;
          content_text?: string;
          content_html?: string;
          date_published?: string;
          tags?: string[];
          authors?: Array<{ name?: string }>;
        }>;
      };
      if (Array.isArray(json.items)) {
        for (const entry of json.items.slice(0, 20)) {
          const title = (entry.title || '').trim();
          const body = stripTags(entry.content_text || entry.content_html || entry.summary || '');
          if (!title || !body) continue;
          const link = sanitizePublicLink(entry.url || fallbackBaseUrl) || fallbackBaseUrl;
          const guid = (entry.id || link || title).trim();
          const summary = (entry.summary ? stripTags(entry.summary) : body.slice(0, 190));
          const publishedAt = entry.date_published ? new Date(entry.date_published).toISOString() : new Date().toISOString();
          const contentHash = crypto.createHash('sha256').update(`${title.toLowerCase()}::${link}`).digest('hex');
          items.push({
            guid,
            title,
            summary,
            body,
            link,
            publishedAt,
            category: entry.tags?.[0],
            author: entry.authors?.[0]?.name,
            contentHash,
          });
        }
      }
      return items;
    } catch {
      throw new Error('Malformed JSON Feed payload.');
    }
  }

  // RSS 2.0 <item> parsing
  const rssItems = trimmed.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  for (const block of rssItems.slice(0, 20)) {
    const title = extractTag(block, 'title');
    const link = sanitizePublicLink(extractTag(block, 'link')) || fallbackBaseUrl;
    const rawDesc = extractTag(block, 'content:encoded') || extractTag(block, 'description');
    const pubDateRaw = extractTag(block, 'pubDate') || extractTag(block, 'dc:date');
    const guid = extractTag(block, 'guid') || link || title;
    const category = extractTag(block, 'category');
    const author = extractTag(block, 'dc:creator') || extractTag(block, 'author');
    if (!title || !rawDesc) continue;
    const parsedDate = pubDateRaw && !Number.isNaN(Date.parse(pubDateRaw)) ? new Date(pubDateRaw).toISOString() : new Date().toISOString();
    const contentHash = crypto.createHash('sha256').update(`${title.toLowerCase()}::${link}`).digest('hex');
    items.push({
      guid,
      title,
      summary: rawDesc.slice(0, 195),
      body: rawDesc,
      link,
      publishedAt: parsedDate,
      category: category || undefined,
      author: author || undefined,
      contentHash,
    });
  }

  if (items.length > 0) return items;

  // Atom <entry> parsing
  const atomEntries = trimmed.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  for (const block of atomEntries.slice(0, 20)) {
    const title = extractTag(block, 'title');
    const linkMatch = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
    const link = sanitizePublicLink(linkMatch?.[1]) || fallbackBaseUrl;
    const body = extractTag(block, 'content') || extractTag(block, 'summary');
    const updated = extractTag(block, 'published') || extractTag(block, 'updated');
    const guid = extractTag(block, 'id') || link || title;
    const author = extractTag(block, 'name');
    if (!title || !body) continue;
    const parsedDate = updated && !Number.isNaN(Date.parse(updated)) ? new Date(updated).toISOString() : new Date().toISOString();
    const contentHash = crypto.createHash('sha256').update(`${title.toLowerCase()}::${link}`).digest('hex');
    items.push({
      guid,
      title,
      summary: body.slice(0, 195),
      body,
      link,
      publishedAt: parsedDate,
      author: author || undefined,
      contentHash,
    });
  }

  return items;
}

export async function fetchAuthorizedFeed(feedUrl: string): Promise<ParsedFeedItem[]> {
  const safeUrl = await validateSafeExternalUrl(feedUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(safeUrl.toString(), {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'DILECT-Institutional-Aggregator/1.0',
        Accept: 'application/rss+xml, application/atom+xml, application/feed+json, application/xml, text/xml, application/json',
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Feed source returned HTTP ${res.status}.`);
    }
    const text = await res.text();
    const parsed = parseFeedPayload(text, safeUrl.toString());
    if (parsed.length === 0) {
      throw new Error('No valid RSS, Atom, or JSON Feed entries were found at this URL.');
    }
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}
