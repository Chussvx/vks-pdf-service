// VKS PDF render service - Render.com Web Service.
//
// Uses puppeteer-core + @sparticuz/chromium because:
//   - The chromium binary ships inside the npm package, so npm install pulls
//     a complete working browser in one step (no separate download race).
//   - Render's Debian-based runtime has libnss3 / libnspr4 / etc. that
//     @sparticuz/chromium needs at runtime (Vercel's AL2023 image doesn't,
//     which is why this combo failed there but works here).

import express from 'express';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const PORT = process.env.PORT || 3000;
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';

const app = express();
app.use(express.json({ limit: '10mb' }));

// CORS for all routes
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Long-lived browser instance. Relaunched if it crashes.
// Retries on ETXTBSY because @sparticuz/chromium extracts its bundled binary
// lazily on first call - if puppeteer.launch() races the extraction, Linux
// rejects the spawn with ETXTBSY (text file busy).
let browserPromise = null;
async function launchWithRetry(maxAttempts = 4) {
  const execPath = await chromium.executablePath();
  let lastErr;
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      return await puppeteer.launch({
        args: [...chromium.args, '--font-render-hinting=none'],
        defaultViewport: chromium.defaultViewport,
        executablePath: execPath,
        headless: chromium.headless,
      });
    } catch (err) {
      lastErr = err;
      const msg = String(err && err.message || err);
      const isBusy = msg.includes('ETXTBSY') || msg.includes('text file busy');
      console.error(`[vks-pdf] launch attempt ${i}/${maxAttempts} failed:`, msg);
      if (!isBusy || i === maxAttempts) throw err;
      // Exponential backoff: 500ms, 1s, 2s
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, i - 1)));
    }
  }
  throw lastErr;
}
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = launchWithRetry().catch(err => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'vks-pdf', version: '3.0.1' });
});
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/api/pdf', async (req, res) => {
  const { html, filename = 'report.pdf', landscape = true, format = 'A4' } = req.body || {};
  if (!html) {
    res.status(400).json({ error: 'html field required' });
    return;
  }
  const safeName = String(filename).replace(/[^a-zA-Z0-9._-]+/g, '_');

  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.evaluateHandle('document.fonts.ready');

    const pdf = await page.pdf({
      format,
      landscape: landscape !== false,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).end(pdf);
  } catch (err) {
    console.error('[pdf] render error:', err);
    res.status(500).json({ error: err.message || String(err) });
  } finally {
    if (page) {
      try { await page.close(); } catch (e) { /* swallow */ }
    }
  }
});

app.listen(PORT, () => {
  console.log(`[vks-pdf] listening on :${PORT}`);
  // Warm the browser at startup so first request isn't slow
  getBrowser().catch(err => console.error('[vks-pdf] preheat failed:', err.message));
});
