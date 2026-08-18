import { useEffect, useRef, useState } from 'react'
import type Vapi from '@vapi-ai/web'
import {
  ArrowRight,
  AudioLines,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Compass,
  FileSearch,
  LayoutDashboard,
  MessageSquareText,
  MoreHorizontal,
  PhoneCall,
  Play,
  Plus,
  Search,
  Sparkles,
  Target,
  WandSparkles,
} from 'lucide-react'
import { getVoiceConfig, previewVoice, validateIdea, type ValidationResult, type VoiceConfig } from './api'
import './App.css'

type Stage = 'evidence' | 'persona' | 'call' | 'direction'

const stages: { key: Stage; number: string; label: string }[] = [
  { key: 'evidence', number: '01', label: 'Evidence' },
  { key: 'persona', number: '02', label: 'Skeptical buyer' },
  { key: 'call', number: '03', label: 'Voice test' },
  { key: 'direction', number: '04', label: 'Next move' },
]

function App() {
  const [activeStage, setActiveStage] = useState<Stage>('evidence')
  const [callIsLive, setCallIsLive] = useState(false)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [validationStatus, setValidationStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig | null>(null)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [liveTranscript, setLiveTranscript] = useState<string | null>(null)
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false)
  const vapiRef = useRef<Vapi | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const [idea, setIdea] = useState(
    'A research copilot that pressure-tests a founder\'s side-hustle idea with evidence and a skeptical voice customer.',
  )

  useEffect(() => {
    let active = true

    void getVoiceConfig()
      .then((config) => {
        if (active) setVoiceConfig(config)
      })
      .catch((error) => {
        if (active) setVoiceError(error instanceof Error ? error.message : 'Voice configuration could not be loaded.')
      })

    return () => {
      active = false
      vapiRef.current?.stop()
      previewAudioRef.current?.pause()
    }
  }, [])

  const selectStage = (stage: Stage) => {
    setActiveStage(stage)
    if (stage !== 'call') setCallIsLive(false)
  }

  const startNewTest = () => {
    vapiRef.current?.stop()
    previewAudioRef.current?.pause()
    setIdea('')
    setValidation(null)
    setValidationStatus('idle')
    setValidationError(null)
    setVoiceError(null)
    setLiveTranscript(null)
    setCallIsLive(false)
    setActiveStage('evidence')
  }

  const startCall = async () => {
    if (!validation) {
      setValidationError('Run the evidence scan before starting a customer call.')
      setActiveStage('evidence')
      return
    }

    if (!voiceConfig?.enabled) {
      setVoiceError(voiceConfig?.message ?? 'Voice configuration is still loading.')
      setActiveStage('call')
      return
    }

    try {
      let vapi = vapiRef.current

      if (!vapi) {
        const { default: vapiModule } = await import('@vapi-ai/web')
        const VapiClient = (vapiModule as unknown as { default: new (publicKey: string) => Vapi }).default
        vapi = new VapiClient(voiceConfig.publicKey)
        vapi.on('call-start', () => setCallIsLive(true))
        vapi.on('call-end', () => setCallIsLive(false))
        vapi.on('message', (message) => {
          if (message.type === 'transcript') {
            setLiveTranscript(message.transcript)
          }
        })
        vapi.on('error', () => {
          setCallIsLive(false)
          setVoiceError('Vapi could not connect to the customer assistant. Check the browser call configuration.')
        })
        vapiRef.current = vapi
      }

      setVoiceError(null)
      setLiveTranscript(null)
      setActiveStage('call')
      await vapi.start(voiceConfig.assistantId)
    } catch (error) {
      setCallIsLive(false)
      setVoiceError(error instanceof Error ? error.message : 'Vapi could not start the customer call.')
    }
  }

  const finishCall = () => {
    vapiRef.current?.stop()
    setCallIsLive(false)
    setActiveStage('direction')
  }

  const playVoicePreview = async () => {
    if (!validation) return

    setIsPreviewingVoice(true)
    setVoiceError(null)

    try {
      const audioUrl = URL.createObjectURL(await previewVoice(validation.persona.quote))
      const audio = new Audio(audioUrl)
      previewAudioRef.current = audio
      audio.addEventListener('ended', () => {
        URL.revokeObjectURL(audioUrl)
        setIsPreviewingVoice(false)
      }, { once: true })
      await audio.play()
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : 'Voice preview could not be played.')
      setIsPreviewingVoice(false)
    }
  }

  const requestValidation = async () => {
    const trimmedIdea = idea.trim()

    if (!trimmedIdea) return

    setValidationStatus('loading')
    setValidationError(null)

    try {
      const result = await validateIdea(trimmedIdea)
      setValidation(result)
      setValidationStatus('ready')
      setActiveStage('evidence')
    } catch (error) {
      setValidationStatus('error')
      setValidationError(error instanceof Error ? error.message : 'MarketMirror could not complete that request.')
    }
  }

  const evidenceStatus = validationStatus === 'loading'
    ? 'Finding the friction in live market evidence...'
    : validationError ?? (validation
      ? `${validation.metrics.sourceCount} sources read · ${validation.metrics.competitorClaims} competitor claims compared`
      : 'Your first scan finds evidence and drafts the skeptical buyer.')

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <span></span>
            <span></span>
          </div>
          <span>MarketMirror</span>
        </div>

        <nav className="primary-nav" aria-label="Primary navigation">
          <button className="nav-item active" type="button">
            <LayoutDashboard size={18} strokeWidth={1.8} />
            <span>Workspace</span>
          </button>
          <button className="nav-item" type="button">
            <Compass size={18} strokeWidth={1.8} />
            <span>Discover</span>
          </button>
          <button className="nav-item" type="button">
            <MessageSquareText size={18} strokeWidth={1.8} />
            <span>Conversations</span>
          </button>
          <button className="nav-item" type="button">
            <FileSearch size={18} strokeWidth={1.8} />
            <span>Library</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <button className="nav-item" type="button">
            <CircleHelp size={18} strokeWidth={1.8} />
            <span>Help center</span>
          </button>
          <button className="profile-switcher" type="button">
            <span className="profile-avatar">RS</span>
            <span className="profile-copy">
              <strong>Rikin Shah</strong>
              <small>Founder plan</small>
            </span>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="crumbs">
            <span>Workspace</span>
            <ChevronRight size={15} />
            <strong>New validation</strong>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" type="button" aria-label="Notifications" title="Notifications">
              <Bell size={18} strokeWidth={1.8} />
              <span className="notification-dot"></span>
            </button>
            <button className="new-test-button" type="button" onClick={startNewTest}>
              <Plus size={17} strokeWidth={2} />
              New test
            </button>
          </div>
        </header>

        <div className="page-content">
          <section className="intro">
            <div>
              <p className="eyebrow">MarketMirror / live validation</p>
              <h1>Test the idea before you build it.</h1>
            </div>
            <p className="intro-copy">
              Find the evidence, meet the skeptic, and leave with one next move worth testing.
            </p>
          </section>

          <section className="idea-panel" aria-labelledby="idea-heading">
            <div className="idea-panel-header">
              <div>
                <span className="step-kicker">Your idea</span>
                <h2 id="idea-heading">What are you thinking of building?</h2>
              </div>
              <span className="draft-status"><span></span> Saved just now</span>
            </div>
            <textarea
              aria-label="Business idea"
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              rows={3}
            />
            <div className="idea-panel-footer">
              <span>One clear sentence. Name the buyer and the problem.</span>
              <button
                className="primary-button"
                type="button"
                disabled={validationStatus === 'loading' || !idea.trim()}
                onClick={requestValidation}
              >
                <Search size={17} strokeWidth={2} />
                {validationStatus === 'loading' ? 'Finding friction...' : 'Find the friction'}
              </button>
            </div>
          </section>

          <section className="signal-strip" aria-label="Research signals">
            <div className="signal-intro">
              <span className="signal-pulse" aria-hidden="true"></span>
              <div>
                <strong>{validation ? 'Your validation brief is ready' : 'Ready to pressure-test'}</strong>
                <span>{validation ? 'Evidence in. A more honest product decision out.' : 'Exa finds the proof. Gemini names the risk.'}</span>
              </div>
            </div>
            <div className="signal-metric">
              <strong>{validation?.metrics.sourceCount ?? '—'}</strong>
              <span>relevant sources</span>
            </div>
            <div className="signal-metric">
              <strong>{validation?.metrics.painCount ?? '—'}</strong>
              <span>repeated anxieties</span>
            </div>
            <button className="text-button" type="button" onClick={validation ? () => selectStage('evidence') : requestValidation}>
              {validation ? 'Open evidence' : 'Start the test'} <ArrowRight size={16} />
            </button>
          </section>

          <section className="flow-rail" aria-label="Live validation loop">
            <span className="flow-label">Live validation loop</span>
            <div className="flow-steps">
              <span><b>01</b> Evidence <small>Exa</small></span>
              <ArrowRight size={15} aria-hidden="true" />
              <span><b>02</b> Skeptic <small>Gemini</small></span>
              <ArrowRight size={15} aria-hidden="true" />
              <span><b>03</b> Voice test <small>Vapi + ElevenLabs</small></span>
              <ArrowRight size={15} aria-hidden="true" />
              <span><b>04</b> Next move</span>
            </div>
            <span className="flow-status"><Check size={14} /> One idea at a time</span>
          </section>

          <section className="validation-area" aria-labelledby="validation-heading">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Your validation brief</p>
                <h2 id="validation-heading">Evidence first. Objections next. A decision at the end.</h2>
              </div>
              <span className="completion-label"><Check size={15} /> {validation ? 'Evidence ready' : 'Ready to start'}</span>
            </div>

            <div className="journey-tabs" role="tablist" aria-label="Validation stages">
              {stages.map((stage) => (
                <button
                  className={`journey-tab ${activeStage === stage.key ? 'active' : ''}`}
                  key={stage.key}
                  type="button"
                  role="tab"
                  aria-selected={activeStage === stage.key}
                  onClick={() => selectStage(stage.key)}
                >
                  <span>{stage.number}</span>
                  {stage.label}
                </button>
              ))}
            </div>

            {activeStage === 'evidence' && (
              <section className="workbench evidence-workbench" aria-label="Market evidence">
                <div className="workbench-title-row">
                  <div>
                    <span className="step-kicker">Evidence scan</span>
                    <h3>{validation ? 'The market is already telling you something.' : 'Ask the market first.'}</h3>
                  </div>
                  <span className="source-badge"><Sparkles size={14} /> {validation?.providers.join(' + ') ?? 'Exa + Gemini'}</span>
                </div>
                <div className="evidence-layout">
                  <div className="source-list">
                    {validation ? validation.sources.map((source) => (
                      <article className="source-row" key={source.title}>
                        <span className="source-dot"></span>
                        <div>
                          <span className="source-site">{source.site}</span>
                          <h4>{source.title}</h4>
                        </div>
                        <span className="source-type">{source.type}</span>
                      </article>
                    )) : (
                      <div className="empty-state">
                        <Search size={18} strokeWidth={1.8} />
                        <p>Give MarketMirror an idea. It will find the language real buyers already use.</p>
                      </div>
                    )}
                  </div>
                  <aside className="pattern-note">
                    <span className="note-symbol">01</span>
                    <p>{validation?.insight ?? 'Your strongest contradiction will appear here.'}</p>
                    <strong>{validation ? `Repeated across ${validation.repetitions} signals` : 'Waiting for the first scan'}</strong>
                  </aside>
                </div>
                <div className="workbench-footer">
                  <span className={validationError ? 'validation-error' : ''}>{evidenceStatus}</span>
                  <button className="secondary-button" type="button" disabled={!validation} onClick={() => selectStage('persona')}>
                    Meet the skeptic <ArrowRight size={16} />
                  </button>
                </div>
              </section>
            )}

            {activeStage === 'persona' && (
              <section className="workbench persona-workbench" aria-label="Skeptical customer persona">
                <div className="workbench-title-row">
                  <div>
                    <span className="step-kicker">The skeptical customer</span>
                    <h3>{validation ? `Meet ${validation.persona.name}, not your imaginary cheerleader.` : 'Complete an evidence scan first.'}</h3>
                  </div>
                  <span className="source-badge"><WandSparkles size={14} /> Gemini synthesis</span>
                </div>
                {validation ? (
                  <>
                    <div className="persona-layout">
                      <div className="persona-identity">
                        <img
                          src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=360&q=80"
                          alt={`Portrait placeholder representing ${validation.persona.name}`}
                        />
                        <div>
                          <h4>{validation.persona.name} <span>{validation.persona.age}</span></h4>
                          <p>{validation.persona.role} · {validation.persona.location}</p>
                          <div className="tag-row">
                            {validation.persona.tags.map((tag) => <span key={tag}>{tag}</span>)}
                          </div>
                        </div>
                      </div>
                      <div className="customer-quote">
                        <span>“</span>
                        <p>{validation.persona.quote}</p>
                        <strong>Her resistance, in one sentence</strong>
                      </div>
                    </div>
                    <div className="objection-row">
                      <span>Likely first objection</span>
                      <p>“{validation.persona.objection}”</p>
                      <div className="objection-actions">
                        <button className="secondary-button" type="button" disabled={isPreviewingVoice} onClick={playVoicePreview}>
                          <AudioLines size={16} /> {isPreviewingVoice ? 'Playing…' : 'Preview voice'}
                        </button>
                        <button className="call-button" type="button" onClick={startCall}>
                          <PhoneCall size={17} /> Start the voice call
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="empty-state persona-empty-state">
                    <WandSparkles size={18} strokeWidth={1.8} />
                    <p>Gemini will turn the evidence into a skeptical customer after the research scan finishes.</p>
                  </div>
                )}
              </section>
            )}

            {activeStage === 'call' && (
              <section className="workbench call-workbench" aria-label="Voice reality check">
                <div className="workbench-title-row">
                  <div>
                    <span className="step-kicker">Voice reality check</span>
                    <h3>{callIsLive ? 'Your skeptical customer is on the line.' : 'Let the evidence push back.'}</h3>
                  </div>
                  <span className={`call-status ${callIsLive ? 'live' : ''}`}>
                    <span></span> {callIsLive ? 'Vapi + ElevenLabs · Live' : voiceConfig?.enabled ? 'Vapi + ElevenLabs · Ready' : 'Voice configuration needed'}
                  </span>
                </div>
                <div className="call-layout">
                  <div className="voice-visual" aria-hidden="true">
                    <div className="portrait-ring">
                      <img
                        src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=360&q=80"
                        alt=""
                      />
                    </div>
                    <div className={`waveform ${callIsLive ? 'playing' : ''}`}>
                      {[18, 32, 54, 38, 68, 46, 24, 50, 35, 62, 42, 26].map((height, index) => (
                        <span key={index} style={{ height }}></span>
                      ))}
                    </div>
                  </div>
                  <div className="call-transcript">
                    <span className="transcript-label">The moment to listen for</span>
                    <p>“{liveTranscript ?? validation?.persona.objection ?? 'Run the evidence scan to generate the customer’s first objection.'}”</p>
                    <div className="transcript-meta">
                      <AudioLines size={16} /> {callIsLive ? 'Live transcript capture is active' : 'Vapi will stream the conversation here'}
                    </div>
                  </div>
                </div>
                <div className="workbench-footer">
                  <span className={voiceError ? 'validation-error' : ''}>{voiceError ?? (callIsLive ? 'Listening for the next objection…' : 'A 5 minute call is enough to surface the friction.')}</span>
                  {callIsLive ? (
                    <button className="primary-button" type="button" onClick={finishCall}>
                      Finish &amp; synthesize <ArrowRight size={16} />
                    </button>
                  ) : (
                    <button className="call-button" type="button" onClick={startCall}>
                      <Play size={16} fill="currentColor" /> Begin voice call
                    </button>
                  )}
                </div>
              </section>
            )}

            {activeStage === 'direction' && (
              <section className="workbench direction-workbench" aria-label="Sharper product direction">
                <div className="workbench-title-row">
                  <div>
                    <span className="step-kicker">Sharper direction</span>
                    <h3>{validation ? 'A narrower promise people can evaluate.' : 'Evidence becomes a sharper direction here.'}</h3>
                  </div>
                  <span className="source-badge"><Target size={14} /> Ready to test</span>
                </div>
                <div className="direction-grid">
                  <div className="direction-item wedge">
                    <span>Product wedge</span>
                    <p>{validation?.direction.wedge ?? 'Complete the research scan to generate a product wedge.'}</p>
                  </div>
                  <div className="direction-item headline">
                    <span>Landing-page headline</span>
                    <p>{validation?.direction.headline ?? 'A credible landing-page headline will appear here.'}</p>
                  </div>
                  <div className="direction-item pricing">
                    <span>Pricing hypothesis</span>
                    <p>{validation?.direction.pricing ?? 'A testable pricing hypothesis will appear here.'}</p>
                  </div>
                  <div className="direction-item outreach">
                    <span>Outreach opener</span>
                    <p>{validation?.direction.outreach ?? 'A concise outreach opener will appear here.'}</p>
                  </div>
                </div>
                <div className="workbench-footer">
                  <span>{validation ? `Built from ${validation.metrics.sourceCount} sources and ${validation.metrics.painCount} pain clusters` : 'Complete the evidence scan to create a direction.'}</span>
                  <button className="secondary-button" type="button" onClick={() => selectStage('evidence')}>
                    Start another test <Plus size={16} />
                  </button>
                </div>
              </section>
            )}
          </section>

          <section className="bottom-prompt">
            <div className="prompt-icon"><MoreHorizontal size={21} /></div>
            <p>Good ideas do not need more encouragement. They need a better argument.</p>
            <button className="icon-button" type="button" aria-label="Open validation options" title="Open options">
              <ChevronRight size={19} />
            </button>
          </section>
        </div>
      </main>
    </div>
  )
}

export default App
