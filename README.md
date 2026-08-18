# MarketMirror

MarketMirror pressure-tests a founder's idea with cited research, a skeptical customer persona, and a real voice conversation.

## Tonight's scope

Do not integrate every event sponsor. The working demo path is:

1. Exa finds evidence.
2. Gemini produces a skeptical customer and a clearer product wedge.
3. Vapi runs the browser call with an ElevenLabs voice.

Exa plus Gemini is the minimum viable demo. Add Vapi and ElevenLabs only after the research loop works. Apify remains optional enrichment.

## Run locally

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

The combined development command starts the Express API at `http://127.0.0.1:8787` and the web app at `http://localhost:5173`.

## Provider keys

Add these values to `.env`. The file is ignored by Git.

| Variable | Required for | Notes |
| --- | --- | --- |
| `EXA_API_KEY` | Market evidence | Required for `POST /api/validate`. |
| `GEMINI_API_KEY` | Persona and launch synthesis | Required for `POST /api/validate`. Set `GEMINI_MODEL` if your account uses a different model. |
| `APIFY_API_TOKEN` and `APIFY_ACTOR_ID` | Optional fresh web enrichment | The selected Actor must accept `startUrls`. |
| `VAPI_PUBLIC_KEY` and `VAPI_ASSISTANT_ID` | Browser voice calls | The public key is returned to the browser; never expose a Vapi private key. |
| `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` | Persona voice preview | The Vapi assistant can also be configured with an ElevenLabs voice. |

Configure the Vapi assistant with an ElevenLabs `11labs` voice, then point its server URL at `/api/webhooks/vapi` through a public HTTPS tunnel when working locally.

## API contract

- `GET /api/health` reports configured providers without exposing credentials.
- `POST /api/validate` accepts `{ "idea": "..." }`, calls Exa, optionally enriches with Apify, and asks Gemini for structured evidence, persona, and product direction.
- `GET /api/voice/config` returns the safe Vapi browser configuration.
- `POST /api/voice/preview` streams an ElevenLabs MP3 from `{ "text": "..." }`.
- `POST /api/webhooks/vapi` receives Vapi call events.

## MCP handoff

Keep MCP access on the server side. Add its adapter beside the provider functions in [server/index.ts](server/index.ts), pass only structured results into the validation flow, and keep its token in `.env`. Do not use `VITE_` variables for private API keys or MCP credentials.

## Verification

```powershell
npm run build
npm run lint
```
