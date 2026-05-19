# Weather Meme

Weather Meme turns the visitor's local forecast into a Memelord reaction meme.

Production URL: https://weathermeme.app

## Local development

```bash
npm install
cp .env.example .env.local
# add MEMELORD_API_KEY to .env.local
npm run dev -- --host 127.0.0.1
```

## Deployment

This app is a Vite React frontend with a Vercel serverless API route at `/api/weather-meme`.

Required Vercel environment variable:

```bash
MEMELORD_API_KEY=your_memelord_api_key
```
