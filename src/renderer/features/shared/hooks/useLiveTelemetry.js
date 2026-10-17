import { configurationReadiness } from '../../../../shared/protocol/configuration-readiness.js'
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../../core/store.js'
import { telemetryState, telemetryIssues } from '../../../../shared/protocol/tuning-live.js'

export function useLiveTelemetry() {
  const realtime = useStore(s => s.realtime)
  const receivedAt = useStore(s => s.realtimeReceivedAt)
  const connected = useStore(s => s.connection.status === 'connected' && s.connection.handshakeStatus === 'ok')
  const error = useStore(s => s.realtimeError)
  const session = useStore(s => s.connection.sessionId)
  const epoch = useStore(s => s.projectEpoch)
  const pages = useStore(s => s.currentProject?.constants?.decodedPages)
  const sensorSettings = pages?.[1]
  const readiness = useMemo(() => configurationReadiness(Object.assign({}, ...Object.values(pages || {}))).filter(issue => !issue.fields.includes('tpsMin')).map(issue => issue.message), [pages])
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!connected) return
    const timer = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(timer)
  }, [connected])
  const status = connected && error ? 'blocked' : telemetryState(connected, receivedAt, Math.max(now, Date.now()))
  return { realtime: status === 'live' ? realtime : null, status, receivedAt, error,
    issues: status === 'live' ? [...telemetryIssues(realtime, sensorSettings), ...readiness] : [], sourceKey: `${session}:${epoch}` }
}
