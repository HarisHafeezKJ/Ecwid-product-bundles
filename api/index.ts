// #region agent log
const _dbg = (location: string, message: string, data: Record<string, unknown>, hypothesisId: string) => {
  fetch('http://127.0.0.1:7627/ingest/17a22ea5-cb1e-474a-bba3-194752c05bb0', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c36960' },
    body: JSON.stringify({ sessionId: 'c36960', location, message, data, timestamp: Date.now(), hypothesisId, runId: 'pre-fix' }),
  }).catch(() => {});
};
_dbg('api/index.ts:entry', 'Vercel API handler loading', { cwd: process.cwd(), vercel: !!process.env.VERCEL, nodeEnv: process.env.NODE_ENV }, 'A');
// #endregion

import app from '../server/dist/index.js';

// #region agent log
_dbg('api/index.ts:imported', 'Express app imported successfully', { appType: typeof app, hasUse: typeof (app as { use?: unknown }).use }, 'A');
// #endregion

export default app;
