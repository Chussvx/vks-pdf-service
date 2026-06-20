# VKS PDF Service

Free server-side PDF rendering for VKS reports. Express + Puppeteer on Render.com free tier.

## What it does

`POST /api/pdf` with `{ html, filename?, landscape?, format? }` returns a server-rendered PDF blob.
Real Chromium engine, vector text, embedded fonts, proper multi-page output.

## One-click deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Chussvx/vks-pdf-service)

Click the button, sign into Render with GitHub, click **Apply**. Done.

## Manual deploy (5 minutes)

1. **Push this folder to a GitHub repo.** Easiest path: create a new public repo called `vks-pdf-service`, push these files.
2. **Sign in to render.com** with GitHub.
3. Click **New > Web Service > Build and deploy from a Git repository**.
4. Select the `vks-pdf-service` repo.
5. Render auto-detects everything from `render.yaml`. Just click **Create Web Service**.
6. Wait 3-5 minutes for the first build. You will get a URL like `https://vks-pdf-service.onrender.com`.

## Free tier notes

- 750 hours/month free (covers 24/7 single instance).
- Sleeps after 15 minutes of inactivity to save quota.
- First request after sleep takes 30-50 seconds to wake. Subsequent calls are 1-3 seconds.
- Singapore region for lowest latency from Laos.

## Test

```bash
curl -X POST https://YOUR-RENDER-URL.onrender.com/api/pdf \
  -H "Content-Type: application/json" \
  -d '{"html":"<html><body><h1>Hello PDF</h1></body></html>","filename":"test.pdf"}' \
  --output test.pdf
```

## After deploy

Tell Claude the production URL. The frontend's `QCR_PDF_ENDPOINT` constant in `Page_InspectionLogs.html` will be updated to point at it.
