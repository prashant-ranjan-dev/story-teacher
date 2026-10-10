/**
 * Architecture & service-layer specification: Supabase schema and automated image pipeline.
 *
 * NOTE: nothing in the running app persists student data to Supabase yet — only the cover-image cache
 * (StoryImageCacheService) talks to it. The schema below is the target design for profiles, sessions
 * and mastery records. See README "Known gaps".
 */

export interface SupabaseConfigRequirements {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Server-only. Never expose to the browser or commit it. Needed for asset ingestion and admin batch jobs. */
  supabaseServiceRoleKey: string;
}

/**
 * SQL to run in the Supabase SQL editor.
 *
 * Changes from the original DDL:
 *  - new `topic_cover_images` table (the cache previously upserted partial rows into `curriculum_topics`,
 *    which violated its NOT NULL columns);
 *  - `stories.topic_id` no longer has a foreign key: AI stories for free-text topics have ids that do not
 *    exist in `curriculum_topics`, so the FK made those inserts fail;
 *  - Row Level Security is enabled everywhere (the original had none, so the anon key could read and
 *    write every child's data);
 *  - updated_at triggers and indexes added.
 *
 * ------------------------------------------------------------------------------------------------
 * create extension if not exists pgcrypto;
 *
 * create or replace function set_updated_at() returns trigger as $$
 * begin new.updated_at = now(); return new; end; $$ language plpgsql;
 *
 * -- 1. Student profiles (one auth user / guardian may own several children)
 * create table if not exists student_profiles (
 *   id uuid primary key default gen_random_uuid(),
 *   user_id uuid not null references auth.users(id) on delete cascade,
 *   name text not null check (char_length(name) between 1 and 40),
 *   class_grade int not null check (class_grade between 3 and 10),
 *   interests text[] not null default '{}',
 *   favorite_subjects text[] not null default '{}',
 *   xp int not null default 0 check (xp >= 0),
 *   stars int not null default 0 check (stars >= 0),
 *   streak_days int not null default 0 check (streak_days >= 0),
 *   last_active_date date,
 *   created_at timestamptz not null default now(),
 *   updated_at timestamptz not null default now()
 * );
 * create index if not exists student_profiles_user_idx on student_profiles(user_id);
 * create trigger student_profiles_updated before update on student_profiles
 *   for each row execute function set_updated_at();
 *
 * -- 2. Curriculum topics (public, read-only for clients)
 * create table if not exists curriculum_topics (
 *   id text primary key,
 *   class_grades int[] not null,
 *   subject text not null,
 *   domain text not null,
 *   topic text not null,
 *   engaging_title text not null,
 *   hook_description text not null,
 *   estimated_minutes int not null default 12,
 *   image_key text,
 *   learning_objectives jsonb not null default '[]',
 *   next_recommended_topic_id text,
 *   created_at timestamptz not null default now()
 * );
 *
 * -- 2b. Cover images, one per (topic, class)
 * create table if not exists topic_cover_images (
 *   topic_id text not null,
 *   class_grade int not null check (class_grade between 3 and 10),
 *   topic text not null,
 *   image_url text not null,
 *   image_prompt text,
 *   created_at timestamptz not null default now(),
 *   primary key (topic_id, class_grade)
 * );
 *
 * -- 3. Generated stories (shared cache of AI output; no FK, see note above)
 * create table if not exists stories (
 *   id text primary key,
 *   topic_id text,
 *   class_grade int not null check (class_grade between 3 and 10),
 *   title text not null,
 *   topic text not null,
 *   subject text not null,
 *   protagonist text not null,
 *   image_url text,
 *   source text not null default 'ai',
 *   learning_objectives jsonb not null,
 *   sections jsonb not null,
 *   final_challenge jsonb not null,
 *   created_at timestamptz not null default now()
 * );
 * create index if not exists stories_topic_idx on stories(topic_id, class_grade);
 *
 * -- 4. Sessions and interaction telemetry
 * create table if not exists student_sessions (
 *   id uuid primary key default gen_random_uuid(),
 *   student_id uuid not null references student_profiles(id) on delete cascade,
 *   story_id text not null,
 *   topic_id text not null,
 *   progress_percent int not null default 0 check (progress_percent between 0 and 100),
 *   current_section_index int not null default 0,
 *   understanding_score int not null default 0 check (understanding_score between 0 and 100),
 *   difficulty_state text not null default 'standard' check (difficulty_state in ('elementary','standard','advanced')),
 *   completed boolean not null default false,
 *   elapsed_seconds int not null default 0,
 *   answers_log jsonb not null default '[]',
 *   detected_misconceptions jsonb not null default '[]',
 *   created_at timestamptz not null default now(),
 *   updated_at timestamptz not null default now(),
 *   unique (student_id, story_id)
 * );
 * create trigger student_sessions_updated before update on student_sessions
 *   for each row execute function set_updated_at();
 *
 * -- 5. Topic mastery records (guardian reporting)
 * create table if not exists topic_mastery_records (
 *   id uuid primary key default gen_random_uuid(),
 *   student_id uuid not null references student_profiles(id) on delete cascade,
 *   topic_id text not null,
 *   topic_name text not null,
 *   understanding_score int not null check (understanding_score between 0 and 100),
 *   concepts_breakdown jsonb not null,
 *   detected_misconceptions jsonb not null default '[]',
 *   time_spent_minutes int not null default 0,
 *   completed_at timestamptz not null default now()
 * );
 * create index if not exists mastery_student_idx on topic_mastery_records(student_id, completed_at desc);
 *
 * -- 6. Row Level Security
 * alter table student_profiles enable row level security;
 * alter table student_sessions enable row level security;
 * alter table topic_mastery_records enable row level security;
 * alter table curriculum_topics enable row level security;
 * alter table topic_cover_images enable row level security;
 * alter table stories enable row level security;
 *
 * create policy "own profiles" on student_profiles for all
 *   using (user_id = auth.uid()) with check (user_id = auth.uid());
 * create policy "own sessions" on student_sessions for all
 *   using (student_id in (select id from student_profiles where user_id = auth.uid()))
 *   with check (student_id in (select id from student_profiles where user_id = auth.uid()));
 * create policy "own mastery" on topic_mastery_records for all
 *   using (student_id in (select id from student_profiles where user_id = auth.uid()))
 *   with check (student_id in (select id from student_profiles where user_id = auth.uid()));
 * create policy "public read topics" on curriculum_topics for select using (true);
 * create policy "public read covers" on topic_cover_images for select using (true);
 * create policy "public read stories" on stories for select using (true);
 * -- Writes to curriculum_topics / topic_cover_images / stories happen only with the service-role key
 * -- (which bypasses RLS) from the Express server.
 *
 * -- 7. Storage: create a PUBLIC bucket named `topic-visuals` (Dashboard -> Storage).
 * ------------------------------------------------------------------------------------------------
 */

export interface TopicImageSeedPayload {
  topicId: string;
  topic: string;
  classGrade: number;
  subject: string;
  prompt: string;
}

/** Minimal structural types so the pipeline is type-checked without pulling in the SDK. */
export interface ImageCapableGeminiClient {
  models: {
    generateContent(args: {
      model: string;
      contents: unknown;
      config?: unknown;
    }): Promise<{
      candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }>;
    }>;
  };
}

export interface StorageCapableSupabaseClient {
  storage: {
    from(bucket: string): {
      upload(path: string, body: Buffer, opts: { contentType: string; upsert: boolean }): Promise<{ error: { message: string } | null }>;
      getPublicUrl(path: string): { data: { publicUrl: string } };
    };
  };
  from(table: string): {
    upsert(
      row: Record<string, unknown>,
      opts?: { onConflict?: string }
    ): Promise<{ error: { message: string } | null }>;
  };
}

/**
 * Batch pipeline: generate a cover for a curriculum topic, upload to Storage, record the URL.
 * The image model is a parameter (the original hard-coded an unverified model id).
 */
export async function seedTopicVisualPipeline(
  payload: TopicImageSeedPayload,
  geminiClient: ImageCapableGeminiClient,
  supabaseClient: StorageCapableSupabaseClient,
  imageModel: string = process.env.GEMINI_NATIVE_IMAGE_MODEL || ''
): Promise<string> {
  if (!imageModel) {
    throw new Error('Set GEMINI_NATIVE_IMAGE_MODEL (a Gemini model that can return inline image data).');
  }

  const imageResult = await geminiClient.models.generateContent({
    model: imageModel,
    contents: { parts: [{ text: payload.prompt }] },
    config: { imageConfig: { aspectRatio: '16:9' } },
  });

  const base64Data = imageResult.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
  if (!base64Data) throw new Error('Image generation did not return inline binary data');

  const filename = `${payload.topicId.replace(/[^a-zA-Z0-9_-]/g, '_')}_c${payload.classGrade}.png`;
  const bucket = supabaseClient.storage.from('topic-visuals');

  const { error: uploadErr } = await bucket.upload(filename, Buffer.from(base64Data, 'base64'), {
    contentType: 'image/png',
    upsert: true,
  });
  if (uploadErr) throw new Error(`Supabase Storage upload failed: ${uploadErr.message}`);

  const publicUrl = bucket.getPublicUrl(filename).data.publicUrl;

  const { error: dbErr } = await supabaseClient.from('topic_cover_images').upsert(
    {
      topic_id: payload.topicId,
      class_grade: payload.classGrade,
      topic: payload.topic,
      image_url: publicUrl,
      image_prompt: payload.prompt,
    },
    { onConflict: 'topic_id,class_grade' }
  );
  // The original ignored this result, so a failed DB write looked like success.
  if (dbErr) throw new Error(`Could not record image URL: ${dbErr.message}`);

  return publicUrl;
}
