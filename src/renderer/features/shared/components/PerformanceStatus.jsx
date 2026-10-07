import React from 'react'
import { useStore } from '../../../core/store.js'
import { performanceFeatureState } from '../../../../shared/protocol/performance-features.js'

export default function PerformanceStatus({ feature }) {
  const realtime = useStore(state => state.realtime)
  const connected = useStore(state => state.connection.status === 'connected')
  const status = performanceFeatureState(feature, realtime?.performance)
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-gray-300">
      <p>{!connected ? 'Live feature state requires an ECU connection.' : status.conditionsMet
        ? status.selected === feature ? `Selected effect: ${status.selectedLabel}` : `Waiting for higher priority effect: ${status.selectedLabel}`
        : 'Activation conditions are not met, or this feature is disabled/timed out.'}</p>
      <p className="mt-2 text-gray-400">Priority: Pit limiter → Rumble idle → ALS → Pop &amp; bang. Timing, fuel and custom cuts use the same selected effect. Features activate only while the engine is running; standard protections and fixed timing remain in force.</p>
      {['als', 'popBang'].includes(feature) && <p className="mt-2 text-gray-400">DFCO remains active when configured and can suppress the overrun effect by cutting fuel.{realtime?.engine?.dfco && connected ? ' ECU reports DFCO active now.' : ''}</p>}
    </div>
  )
}
