import './server/loadEnv';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

import { AdaptiveLearningBackendService } from './server/AdaptiveLearningService';
import { createRateLimiter } from './server/rateLimit';
import { parseEvaluationRequest, parseStoryRequest, TopicNotAllowedError, ValidationError } from './server/validation';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) {
    // Needed behind a reverse proxy so the rate limiter sees real client IPs.
    app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
  }

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  app.use(express.json({ limit: '20kb' }));

  const adaptiveService = new AdaptiveLearningBackendService();
  const aiLimiter = createRateLimiter({ windowMs: 60_000, max: Number(process.env.AI_RATE_LIMIT_PER_MIN) || 30 });

  const handleError = (label: string, res: Response, error: unknown) => {
    if (error instanceof ValidationError) return res.status(400).json({ error: error.message });
    if (error instanceof TopicNotAllowedError) return res.status(422).json({ error: error.message, code: 'topic_not_allowed' });
    console.error(`${label} failed:`, error);
    return res.status(500).json({ error: `Failed to ${label}` });
  };

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.post('/api/ai/evaluate-answer', aiLimiter, async (req, res) => {
    try {
      const payload = parseEvaluationRequest(req.body);
      res.json(await adaptiveService.evaluateAndAdapt(payload));
    } catch (error) {
      handleError('evaluate answer', res, error);
    }
  });

  app.post('/api/ai/generate-story', aiLimiter, async (req, res) => {
    try {
      const payload = parseStoryRequest(req.body);
      const story = await adaptiveService.generateClassAdaptedStory(payload);
      res.json({ story, source: story.source ?? 'adaptive_service' });
    } catch (error) {
      handleError('generate story', res, error);
    }
  });

  app.get('/api/setup/status', (_req, res) => {
    res.json({
      geminiConfigured: adaptiveService.aiEnabled,
      supabaseConfigured: Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)),
    });
  });

  // Unknown API routes should be JSON 404s, not the SPA's index.html.
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  if (!isProd) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  // Malformed JSON, oversized bodies, etc.
  app.use((err: Error & { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status && err.status >= 400 && err.status < 500 ? err.status : 500;
    if (status === 500) console.error('Unhandled error:', err);
    res.status(status).json({ error: status === 413 ? 'Request too large' : status === 400 ? 'Invalid request' : 'Server error' });
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Story Teacher server listening on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
  });

  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
