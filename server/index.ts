import 'dotenv/config'
import express from 'express'

type SourceType = 'Customer pain' | 'Founder signal' | 'Competitor claim'

interface ResearchSource {
  site: string
  title: string
  excerpt: string
  type: SourceType
  url: string
}

interface Persona {
  name: string
  age: number
  role: string
  location: string
  tags: string[]
  quote: string
  objection: string
}

interface Direction {
  wedge: string
  headline: string
  pricing: string
  outreach: string
}

interface Synthesis {
  painClusters: string[]
  insight: string
  repetitions: number
  persona: Persona
  direction: Direction
}

type JsonRecord = Record<string, unknown>

class ProviderError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const sourceTypes: SourceType[] = ['Customer pain', 'Founder signal', 'Competitor claim']
const app = express()
const port = Number.parseInt(process.env.PORT ?? '8787', 10)

app.disable('x-powered-by')
app.use(express.json({ limit: '64kb' }))

function envValue(name: string) {
  const value = process.env[name]?.trim()
  return value || null
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringArray(value: unknown) {
  return asArray(value)
    .map(stringValue)
    .filter((item): item is string => item !== null)
}

function siteFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'web source'
  }
}

function clip(text: string, length = 800) {
  return text.replace(/\s+/g, ' ').trim().slice(0, length)
}

function providerStatus() {
  return {
    exa: Boolean(envValue('EXA_API_KEY')),
    gemini: Boolean(envValue('GEMINI_API_KEY')),
    apify: Boolean(envValue('APIFY_API_TOKEN') && envValue('APIFY_ACTOR_ID')),
    vapi: Boolean(envValue('VAPI_PUBLIC_KEY') && envValue('VAPI_ASSISTANT_ID')),
    elevenLabs: Boolean(envValue('ELEVENLABS_API_KEY') && envValue('ELEVENLABS_VOICE_ID')),
  }
}

async function responseJson(response: Response, provider: string): Promise<unknown> {
  const text = await response.text()

  if (!response.ok) {
    throw new ProviderError(502, `${provider} could not complete this request.`)
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new ProviderError(502, `${provider} returned an unreadable response.`)
  }
}

async function getExaEvidence(idea: string): Promise<ResearchSource[]> {
  const apiKey = envValue('EXA_API_KEY')

  if (!apiKey) {
    throw new ProviderError(503, 'Exa is not configured. Add EXA_API_KEY to .env.')
  }

  const response = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      query: `${idea}\nFind evidence of customer pain, competitor positioning, and objections.`,
      type: 'auto',
      numResults: 8,
      contents: {
        text: {
          maxCharacters: 900,
        },
      },
    }),
  })
  const payload = await responseJson(response, 'Exa')
  const results = isRecord(payload) ? asArray(payload.results) : []
  const sources = results
    .map((result, index) => {
      if (!isRecord(result)) return null

      const url = stringValue(result.url) ?? ''
      const title = stringValue(result.title) ?? `Research signal ${index + 1}`
      const excerpt = clip(stringValue(result.text) ?? stringValue(result.highlights) ?? title)

      return {
        site: siteFromUrl(url),
        title,
        excerpt,
        type: sourceTypes[index % sourceTypes.length],
        url,
      }
    })
    .filter((source): source is ResearchSource => source !== null)

  if (sources.length === 0) {
    throw new ProviderError(502, 'Exa returned no usable research sources. Try a more specific idea.')
  }

  return sources
}

function recordExcerpt(record: JsonRecord) {
  const candidates = [record.text, record.markdown, record.content, record.description, record.excerpt]
  const value = candidates.map(stringValue).find((item): item is string => item !== null)
  return value ? clip(value) : null
}

async function getApifyEvidence(sources: ResearchSource[]): Promise<ResearchSource[]> {
  const token = envValue('APIFY_API_TOKEN')
  const actorId = envValue('APIFY_ACTOR_ID')

  if (!token || !actorId || sources.length === 0) return []

  const actor = encodeURIComponent(actorId.replace('/', '~'))
  const response = await fetch(
    `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: sources.slice(0, 3).map((source) => ({ url: source.url })).filter((item) => item.url),
        maxCrawlPages: 3,
        maxCrawlDepth: 0,
      }),
    },
  )
  const payload = await responseJson(response, 'Apify')

  return asArray(payload)
    .map((item, index): ResearchSource | null => {
      if (!isRecord(item)) return null

      const url = stringValue(item.url) ?? stringValue(item.loadedUrl) ?? ''
      const excerpt = recordExcerpt(item)

      if (!excerpt) return null

      return {
        site: siteFromUrl(url),
        title: stringValue(item.title) ?? `Fresh web signal ${index + 1}`,
        excerpt,
        type: 'Customer pain' as const,
        url,
      }
    })
    .filter((source): source is ResearchSource => source !== null)
}

function synthesisPrompt(idea: string, sources: ResearchSource[]) {
  const evidence = sources
    .map((source, index) => `Source ${index + 1}\nTitle: ${source.title}\nSite: ${source.site}\nExcerpt: ${source.excerpt}`)
    .join('\n\n')

  return `You are MarketMirror, a skeptical product-validation analyst. Use only the evidence below. Do not invent citations or pretend the sources say something they do not. The founder's idea is delimited by IDEA.

IDEA
${idea}
END IDEA

EVIDENCE
${evidence}
END EVIDENCE

Return valid JSON only with this exact shape:
{
  "painClusters": ["short customer pain statement"],
  "insight": "the sharpest recurring pattern",
  "repetitions": 0,
  "persona": {
    "name": "first name only",
    "age": 32,
    "role": "job and relevant context",
    "location": "city",
    "tags": ["three concise traits"],
    "quote": "one skeptical sentence in first person",
    "objection": "the toughest first objection"
  },
  "direction": {
    "wedge": "a narrow product wedge",
    "headline": "a credible landing-page headline",
    "pricing": "a testable pricing hypothesis",
    "outreach": "one concise outreach opener"
  }
}`
}

function geminiText(payload: unknown) {
  const root = isRecord(payload) ? payload : null
  const candidate = root ? asArray(root.candidates)[0] : null
  const content = isRecord(candidate) ? candidate.content : null
  const part = isRecord(content) ? asArray(content.parts)[0] : null
  const text = isRecord(part) ? stringValue(part.text) : null

  if (!text) {
    throw new ProviderError(502, 'Gemini returned no synthesis text.')
  }

  return text.replace(/^```json\s*|\s*```$/g, '').trim()
}

function requiredRecord(value: unknown, label: string) {
  if (!isRecord(value)) {
    throw new ProviderError(502, `Gemini returned an incomplete ${label}.`)
  }

  return value
}

function requiredString(record: JsonRecord, key: string) {
  const value = stringValue(record[key])

  if (!value) {
    throw new ProviderError(502, `Gemini returned an incomplete ${key}.`)
  }

  return value
}

function parseSynthesis(text: string): Synthesis {
  let parsed: unknown

  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    throw new ProviderError(502, 'Gemini returned invalid structured data. Retry the validation.')
  }

  const root = requiredRecord(parsed, 'response')
  const persona = requiredRecord(root.persona, 'persona')
  const direction = requiredRecord(root.direction, 'direction')
  const painClusters = stringArray(root.painClusters).slice(0, 4)

  if (painClusters.length === 0) {
    throw new ProviderError(502, 'Gemini returned no pain clusters. Retry the validation.')
  }

  return {
    painClusters,
    insight: requiredString(root, 'insight'),
    repetitions: numberValue(root.repetitions) ?? painClusters.length,
    persona: {
      name: requiredString(persona, 'name'),
      age: numberValue(persona.age) ?? 32,
      role: requiredString(persona, 'role'),
      location: requiredString(persona, 'location'),
      tags: stringArray(persona.tags).slice(0, 3),
      quote: requiredString(persona, 'quote'),
      objection: requiredString(persona, 'objection'),
    },
    direction: {
      wedge: requiredString(direction, 'wedge'),
      headline: requiredString(direction, 'headline'),
      pricing: requiredString(direction, 'pricing'),
      outreach: requiredString(direction, 'outreach'),
    },
  }
}

async function getSynthesis(idea: string, sources: ResearchSource[]) {
  const apiKey = envValue('GEMINI_API_KEY')

  if (!apiKey) {
    throw new ProviderError(503, 'Gemini is not configured. Add GEMINI_API_KEY to .env.')
  }

  const model = envValue('GEMINI_MODEL') ?? 'gemini-3.7-flash'
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: synthesisPrompt(idea, sources) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.35,
        },
      }),
    },
  )
  const payload = await responseJson(response, 'Gemini')
  return parseSynthesis(geminiText(payload))
}

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    providers: providerStatus(),
  })
})

app.post('/api/validate', async (request, response) => {
  const body: unknown = request.body
  const idea = isRecord(body) ? stringValue(body.idea) : null

  if (!idea || idea.length > 2_000) {
    response.status(400).json({ error: 'Send an idea between 1 and 2,000 characters.' })
    return
  }

  const exaSources = await getExaEvidence(idea)
  const warnings: string[] = []
  let apifySources: ResearchSource[] = []

  if (providerStatus().apify) {
    try {
      apifySources = await getApifyEvidence(exaSources)
    } catch (error) {
      console.warn('Apify enrichment skipped:', error instanceof Error ? error.message : 'Unknown error')
      warnings.push('Apify enrichment was unavailable, so this run uses Exa evidence only.')
    }
  }

  const sources = [...exaSources, ...apifySources].slice(0, 10)
  const synthesis = await getSynthesis(idea, sources)

  response.json({
    idea,
    sources,
    metrics: {
      sourceCount: sources.length,
      painCount: synthesis.painClusters.length,
      competitorClaims: sources.filter((source) => source.type === 'Competitor claim').length,
    },
    ...synthesis,
    providers: ['Exa', 'Gemini', ...(apifySources.length > 0 ? ['Apify'] : [])],
    warnings,
  })
})

app.get('/api/voice/config', (_request, response) => {
  const publicKey = envValue('VAPI_PUBLIC_KEY')
  const assistantId = envValue('VAPI_ASSISTANT_ID')

  if (!publicKey || !assistantId) {
    response.json({
      enabled: false,
      message: 'Add VAPI_PUBLIC_KEY and VAPI_ASSISTANT_ID to enable browser voice calls.',
    })
    return
  }

  response.json({
    enabled: true,
    publicKey,
    assistantId,
  })
})

app.post('/api/voice/preview', async (request, response) => {
  const body: unknown = request.body
  const text = isRecord(body) ? stringValue(body.text) : null
  const apiKey = envValue('ELEVENLABS_API_KEY')
  const voiceId = envValue('ELEVENLABS_VOICE_ID')

  if (!text || text.length > 1_000) {
    response.status(400).json({ error: 'Send preview text between 1 and 1,000 characters.' })
    return
  }

  if (!apiKey || !voiceId) {
    response.status(503).json({ error: 'ElevenLabs is not configured. Add ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID to .env.' })
    return
  }

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
      }),
    },
  )

  if (!upstream.ok) {
    throw new ProviderError(502, 'ElevenLabs could not create a voice preview.')
  }

  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'audio/mpeg')
  response.send(Buffer.from(await upstream.arrayBuffer()))
})

app.post('/api/webhooks/vapi', (request, response) => {
  const body = isRecord(request.body) ? request.body : null
  const message = body && isRecord(body.message) ? body.message : null
  const call = message && isRecord(message.call) ? message.call : null
  const type = message ? stringValue(message.type) : null
  const callId = call ? stringValue(call.id) : null

  console.info(`Vapi webhook received: ${type ?? 'unknown'}${callId ? ` for ${callId}` : ''}`)
  response.status(200).json({ received: true })
})

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const knownError = error instanceof ProviderError
  const malformedJson = error instanceof SyntaxError && isRecord(error) && error.status === 400
  console.error('API request failed:', error instanceof Error ? error.message : error)
  response.status(malformedJson ? 400 : knownError ? error.status : 500).json({
    error: malformedJson
      ? 'Send valid JSON in the request body.'
      : knownError
        ? error.message
        : 'MarketMirror could not complete that request. Please retry.',
  })
})

app.listen(port, () => {
  console.info(`MarketMirror API listening at http://127.0.0.1:${port}`)
})