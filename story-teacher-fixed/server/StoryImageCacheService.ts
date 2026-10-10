/**
 * Cover-image cache: in-memory LRU in front of Supabase (Storage bucket `topic-visuals` + table
 * `topic_cover_images`, see SupabaseServiceLayerSpec.ts).
 *
 * Fixes over the original:
 *  - lookups are per (topic, class) — the old code keyed the cache by class but queried Supabase by topic only;
 *  - writes go to a dedicated `topic_cover_images` table. The old code upserted partial rows into
 *    `curriculum_topics`, whose NOT NULL columns (subject, domain, engaging_title, hook_description)
 *    were never supplied, so every upsert failed — and the response was never checked, so it failed silently;
 *  - every HTTP call is time-limited and its status is checked;
 *  - the server-only service-role key is preferred for writes (anon-key writes need dangerously open RLS);
 *  - the in-memory map is a bounded LRU (it used to grow without limit and hold multi-MB data URLs);
 *  - throwaway SVG fallbacks are never written to Supabase and the unused local-disk code is gone.
 */

export interface StoryImageRecord {
  topicId: string;
  topic: string;
  classGrade: number;
  imageUrl: string;
  imagePrompt: string;
  source: 'supabase' | 'generated' | 'fallback_svg';
  createdAt: string;
}

const BUCKET = 'topic-visuals';
const REQUEST_TIMEOUT_MS = 6000;

class LruMap<V> {
  private map = new Map<string, V>();
  constructor(private readonly max: number) {}
  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v !== undefined) {
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }
  set(key: string, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }
}

export class StoryImageCacheService {
  private readonly cache = new LruMap<StoryImageRecord>(40);
  private readonly supabaseUrl: string | null;
  private readonly readKey: string | null;
  private readonly writeKey: string | null;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.supabaseUrl = env.SUPABASE_URL?.replace(/\/+$/, '') || null;
    const anon = env.SUPABASE_ANON_KEY || null;
    const service = env.SUPABASE_SERVICE_ROLE_KEY || null;
    this.readKey = service || anon;
    this.writeKey = service || anon;
    if (this.supabaseUrl && !service) {
      console.warn(
        '[image-cache] SUPABASE_SERVICE_ROLE_KEY is not set; writing with the anon key requires permissive RLS policies. ' +
          'Use the service-role key on the server instead.'
      );
    }
  }

  get isConfigured(): boolean {
    return Boolean(this.supabaseUrl && this.readKey);
  }

  private key(topicId: string, classGrade: number): string {
    return `${topicId.toLowerCase().trim()}::${classGrade}`;
  }

  private headers(apiKey: string, extra: Record<string, string> = {}): Record<string, string> {
    return { apikey: apiKey, Authorization: `Bearer ${apiKey}`, ...extra };
  }

  async getExistingCover(topicId: string, classGrade: number): Promise<StoryImageRecord | null> {
    const memKey = this.key(topicId, classGrade);
    const hit = this.cache.get(memKey);
    if (hit) return hit;

    if (!this.supabaseUrl || !this.readKey) return null;
    try {
      const url =
        `${this.supabaseUrl}/rest/v1/topic_cover_images` +
        `?topic_id=eq.${encodeURIComponent(topicId)}&class_grade=eq.${classGrade}` +
        `&select=topic_id,class_grade,topic,image_url,image_prompt&limit=1`;
      const resp = await fetch(url, {
        headers: this.headers(this.readKey),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!resp.ok) {
        console.warn(`[image-cache] lookup failed: HTTP ${resp.status}`);
        return null;
      }
      const rows = (await resp.json()) as Array<{ topic?: string; image_url?: string; image_prompt?: string }>;
      const row = rows[0];
      if (!row?.image_url) return null;
      const record: StoryImageRecord = {
        topicId,
        topic: row.topic || topicId,
        classGrade,
        imageUrl: row.image_url,
        imagePrompt: row.image_prompt || '',
        source: 'supabase',
        createdAt: new Date().toISOString(),
      };
      this.cache.set(memKey, record);
      return record;
    } catch (err) {
      console.warn('[image-cache] lookup error:', err instanceof Error ? err.message : err);
      return null;
    }
  }

  /** Persists a generated PNG (base64) and returns a URL: the public CDN URL, or a data URL if Supabase is unavailable. */
  async saveCoverImage(
    topicId: string,
    topicName: string,
    classGrade: number,
    base64Png: string,
    prompt: string
  ): Promise<string> {
    let finalUrl = `data:image/png;base64,${base64Png}`;
    let source: StoryImageRecord['source'] = 'generated';

    if (this.supabaseUrl && this.writeKey) {
      try {
        const filename = `${topicId.replace(/[^a-zA-Z0-9_-]/g, '_')}_c${classGrade}.png`;
        const upload = await fetch(`${this.supabaseUrl}/storage/v1/object/${BUCKET}/${filename}`, {
          method: 'POST',
          headers: this.headers(this.writeKey, { 'Content-Type': 'image/png', 'x-upsert': 'true' }),
          body: Buffer.from(base64Png, 'base64'),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS * 2),
        });
        if (!upload.ok) throw new Error(`storage upload HTTP ${upload.status}`);

        const cdnUrl = `${this.supabaseUrl}/storage/v1/object/public/${BUCKET}/${filename}`;
        const row = await fetch(`${this.supabaseUrl}/rest/v1/topic_cover_images?on_conflict=topic_id,class_grade`, {
          method: 'POST',
          headers: this.headers(this.writeKey, {
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal',
          }),
          body: JSON.stringify({
            topic_id: topicId,
            class_grade: classGrade,
            topic: topicName,
            image_url: cdnUrl,
            image_prompt: prompt,
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!row.ok) throw new Error(`table upsert HTTP ${row.status}`);

        finalUrl = cdnUrl;
        source = 'supabase';
      } catch (err) {
        console.warn('[image-cache] could not persist to Supabase, using data URL:', err instanceof Error ? err.message : err);
      }
    }

    this.cache.set(this.key(topicId, classGrade), {
      topicId,
      topic: topicName,
      classGrade,
      imageUrl: finalUrl,
      imagePrompt: prompt,
      source,
      createdAt: new Date().toISOString(),
    });
    return finalUrl;
  }
}

export const storyImageCache = new StoryImageCacheService();
