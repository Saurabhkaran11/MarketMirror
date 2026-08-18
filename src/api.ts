export interface ResearchSource {
  site: string
  title: string
  excerpt: string
  type: 'Customer pain' | 'Founder signal' | 'Competitor claim'
  url: string
}

export interface ValidationResult {
  idea: string
  sources: ResearchSource[]
  metrics: {
    sourceCount: number
    painCount: number
    competitorClaims: number
  }
  painClusters: string[]
  insight: string
  repetitions: number
  persona: {
    name: string
    age: number
    role: string
    location: string
    tags: string[]
    quote: string
    objection: string
  }
  direction: {
    wedge: string
    headline: string
    pricing: string
    outreach: string
  }
  providers: string[]
  warnings: string[]
}

export type VoiceConfig =
  | {
      enabled: true
      publicKey: string
      assistantId: string
    }
  | {
      enabled: false
      message: string
    }

interface ApiError {
  error?: string
}

function isApiError(value: unknown): value is ApiError {
  return typeof value === 'object' && value !== null && 'error' in value
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(isApiError(payload) && typeof payload.error === 'string'
      ? payload.error
      : 'MarketMirror could not complete that request.')
  }

  return payload as T
}

export function validateIdea(idea: string) {
  return apiRequest<ValidationResult>('/api/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idea }),
  })
}

export function getVoiceConfig() {
  return apiRequest<VoiceConfig>('/api/voice/config')
}

export async function previewVoice(text: string) {
  const response = await fetch('/api/voice/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null)
    throw new Error(isApiError(payload) && typeof payload.error === 'string'
      ? payload.error
      : 'MarketMirror could not create the voice preview.')
  }

  return response.blob()
}