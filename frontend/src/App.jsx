import { useState, useRef, useEffect } from 'react'

const API_BASE = '/api'

const SAMPLES = [
  {
    label: 'spam',
    text: "CONGRATULATIONS! You've been selected to receive a FREE $1000 Walmart gift card. Click here immediately to claim your prize before it expires: bit.ly/claim-now-2024. Limited time offer, act now!!!",
  },
  {
    label: 'ham',
    text: "Hi team, just a reminder that the quarterly report is due by Friday end of day. Please send your sections to me by Wednesday so I have time to compile everything. Let me know if you have any questions.",
  },
]

function GaugeNeedle({ probability }) {
  const angle = -90 + probability * 180
  return (
    <svg viewBox="0 0 200 110" className="w-full max-w-[260px] mx-auto">
      <defs>
        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--signal)" />
          <stop offset="50%" stopColor="var(--gold)" />
          <stop offset="100%" stopColor="var(--alert)" />
        </linearGradient>
      </defs>
      <path
        d="M 15 100 A 85 85 0 0 1 185 100"
        fill="none"
        stroke="url(#gaugeGrad)"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <g transform={`rotate(${angle}, 100, 100)`} style={{ transition: 'transform 0.6s cubic-bezier(0.22,1,0.36,1)' }}>
        <line x1="100" y1="100" x2="100" y2="28" stroke="var(--paper)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="100" cy="100" r="6" fill="var(--paper)" />
      </g>
      <text x="15" y="98" fill="var(--signal)" fontSize="9" fontFamily="JetBrains Mono">HAM</text>
      <text x="155" y="98" fill="var(--alert)" fontSize="9" fontFamily="JetBrains Mono">SPAM</text>
    </svg>
  )
}

function ResultCard({ result }) {
  if (!result) return null
  if (result.error) {
    return (
      <div className="border border-[var(--alert-dim)] bg-[var(--alert-dim)]/10 rounded-lg p-4 text-sm font-mono text-[var(--alert)]">
        ERROR: {result.error}
      </div>
    )
  }
  const isSpam = result.label === 'spam'
  const accentColor = isSpam ? 'var(--alert)' : 'var(--signal)'
  return (
    <div
      className="rounded-xl border p-6 transition-all duration-500"
      style={{
        borderColor: isSpam ? 'var(--alert-dim)' : 'var(--signal-dim)',
        background: isSpam ? 'rgba(255,107,91,0.06)' : 'rgba(61,220,151,0.06)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full pulse-dot" style={{ background: accentColor }} />
          <span className="font-mono text-xs tracking-widest uppercase" style={{ color: accentColor }}>
            classification result
          </span>
        </div>
        <span className="font-mono text-[11px] text-[var(--slate)]">
          {result.inference_time_ms}ms
        </span>
      </div>

      <div className="font-display text-5xl font-bold mb-1" style={{ color: accentColor }}>
        {result.label.toUpperCase()}
      </div>
      <div className="text-[var(--slate)] text-sm mb-5">
        Confidence: <span className="font-mono text-[var(--paper)]">{(result.confidence * 100).toFixed(1)}%</span>
      </div>

      <GaugeNeedle probability={result.spam_probability} />

      <div className="grid grid-cols-2 gap-3 mt-5 font-mono text-xs">
        <div className="bg-[var(--ink)] rounded-lg p-3 border border-[var(--ink-line)]">
          <div className="text-[var(--slate)] mb-1">HAM PROB.</div>
          <div className="text-[var(--signal)] text-lg">{(result.ham_probability * 100).toFixed(2)}%</div>
        </div>
        <div className="bg-[var(--ink)] rounded-lg p-3 border border-[var(--ink-line)]">
          <div className="text-[var(--slate)] mb-1">SPAM PROB.</div>
          <div className="text-[var(--alert)] text-lg">{(result.spam_probability * 100).toFixed(2)}%</div>
        </div>
      </div>
    </div>
  )
}

function HistoryFeed({ history }) {
  if (history.length === 0) {
    return (
      <div className="font-mono text-xs text-[var(--slate)] py-6 text-center border border-dashed border-[var(--ink-line)] rounded-lg">
        no scans yet — log will appear here
      </div>
    )
  }
  return (
    <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
      {history.map((h, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-3 bg-[var(--ink-raised)] border border-[var(--ink-line)] rounded-lg px-3 py-2.5"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: h.label === 'spam' ? 'var(--alert)' : 'var(--signal)' }}
            />
            <span className="text-xs text-[var(--paper)]/80 truncate font-mono">{h.text}</span>
          </div>
          <span
            className="font-mono text-[10px] uppercase tracking-wider shrink-0"
            style={{ color: h.label === 'spam' ? 'var(--alert)' : 'var(--signal)' }}
          >
            {h.label} · {(h.confidence * 100).toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [apiStatus, setApiStatus] = useState('checking')
  const textareaRef = useRef(null)

  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then((r) => r.json())
      .then((d) => setApiStatus(d.status === 'ok' ? 'online' : 'offline'))
      .catch(() => setApiStatus('offline'))

    fetch(`${API_BASE}/metrics`)
      .then((r) => r.json())
      .then(setMetrics)
      .catch(() => {})
  }, [])

  const handleScan = async () => {
    if (!text.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`${API_BASE}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Request failed')
      }
      const data = await res.json()
      setResult(data)
      setHistory((prev) => [
        { text: text.length > 60 ? text.slice(0, 60) + '…' : text, label: data.label, confidence: data.confidence },
        ...prev,
      ].slice(0, 12))
    } catch (e) {
      setResult({ error: e.message })
    } finally {
      setLoading(false)
    }
  }

  const loadSample = (sample) => {
    setText(sample.text)
    textareaRef.current?.focus()
  }

  const lrMetrics = metrics?.results?.LogisticRegression

  return (
    <div className="min-h-screen bg-[var(--ink)] text-[var(--paper)]">
      <header className="border-b border-[var(--ink-line)] sticky top-0 bg-[var(--ink)]/90 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-[var(--signal)]/10 border border-[var(--signal-dim)] flex items-center justify-center font-mono text-[var(--signal)] text-sm font-semibold">
              S/H
            </div>
            <div>
              <div className="font-display font-semibold text-sm leading-tight">Spam/Ham Classifier</div>
              <div className="font-mono text-[10px] text-[var(--slate)]">text triage engine</div>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: apiStatus === 'online' ? 'var(--signal)' : apiStatus === 'checking' ? 'var(--gold)' : 'var(--alert)' }}
            />
            <span className="text-[var(--slate)]">API {apiStatus}</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-10">
          <div className="font-mono text-xs text-[var(--signal)] tracking-widest uppercase mb-3">
            01 — live classification
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold leading-tight max-w-2xl">
            Drop in a message. <span className="text-[var(--slate)]">Find out if it's signal or noise.</span>
          </h1>
          <p className="text-[var(--slate)] mt-4 max-w-xl text-sm leading-relaxed">
            A logistic-regression model trained on TF-IDF features over ~10,000 labeled emails. Paste any text below and the engine scores it for spam probability in real time.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-4">
            <div className="relative rounded-xl border border-[var(--ink-line)] bg-[var(--ink-raised)] overflow-hidden">
              {loading && (
                <div className="absolute left-0 right-0 top-0 h-px bg-[var(--signal)] scan-line shadow-[0_0_8px_var(--signal)]" />
              )}
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste an email, SMS, or message here to scan it..."
                className="w-full h-56 bg-transparent p-4 text-sm font-mono resize-none outline-none placeholder:text-[var(--slate)]/60"
              />
              <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--ink-line)]">
                <span className="font-mono text-[11px] text-[var(--slate)]">{text.length} chars</span>
                <div className="flex gap-2">
                  {SAMPLES.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => loadSample(s)}
                      className="font-mono text-[11px] px-2.5 py-1 rounded border border-[var(--ink-line)] text-[var(--slate)] hover:text-[var(--paper)] hover:border-[var(--slate)] transition-colors"
                    >
                      sample: {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleScan}
              disabled={loading || !text.trim()}
              className="w-full py-3.5 rounded-xl font-display font-semibold text-sm tracking-wide uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--signal)', color: 'var(--ink)' }}
            >
              {loading ? 'Scanning…' : 'Scan Text'}
            </button>

            <div>
              <div className="font-mono text-xs text-[var(--slate)] tracking-widest uppercase mb-3">
                scan log
              </div>
              <HistoryFeed history={history} />
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            {result ? (
              <ResultCard result={result} />
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--ink-line)] p-10 text-center">
                <div className="font-mono text-xs text-[var(--slate)]">
                  awaiting input — result will render here
                </div>
              </div>
            )}

            {lrMetrics && (
              <div className="rounded-xl border border-[var(--ink-line)] bg-[var(--ink-raised)] p-5">
                <div className="font-mono text-xs text-[var(--slate)] tracking-widest uppercase mb-3">
                  02 — model benchmarks
                </div>
                <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                  <Metric label="accuracy" value={lrMetrics.accuracy} />
                  <Metric label="precision" value={lrMetrics.precision} />
                  <Metric label="recall" value={lrMetrics.recall} />
                  <Metric label="f1 score" value={lrMetrics.f1} />
                </div>
                <div className="mt-3 pt-3 border-t border-[var(--ink-line)] font-mono text-[10px] text-[var(--slate)]">
                  trained on {metrics.dataset_size?.toLocaleString()} samples · {metrics.train_size?.toLocaleString()} train / {metrics.test_size?.toLocaleString()} test
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-[var(--ink-line)] mt-12">
        <div className="max-w-6xl mx-auto px-6 py-6 font-mono text-[11px] text-[var(--slate)] flex items-center justify-between">
          <span>FastAPI · scikit-learn · React</span>
          <span>built for batch & single-text inference</span>
        </div>
      </footer>
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div className="bg-[var(--ink)] rounded-lg p-3 border border-[var(--ink-line)]">
      <div className="text-[var(--slate)] mb-1 uppercase tracking-wider text-[10px]">{label}</div>
      <div className="text-[var(--paper)] text-base">{(value * 100).toFixed(2)}%</div>
    </div>
  )
}
