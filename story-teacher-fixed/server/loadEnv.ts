import dotenv from 'dotenv';

// Imported FIRST by server.ts. ES module imports are hoisted, so calling dotenv.config() in the body of
// server.ts ran after module-level singletons (e.g. the Supabase image cache) had already read process.env.
// Earlier paths win, so .env.local overrides .env.
dotenv.config({ path: ['.env.local', '.env'], quiet: true });
