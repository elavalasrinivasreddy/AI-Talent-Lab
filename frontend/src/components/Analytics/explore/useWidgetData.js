/**
 * useWidgetData — fetch one widget's chart data from POST /analytics/query.
 * Re-runs whenever the (value-compared) spec changes; cancels stale responses.
 */
import { useState, useEffect } from 'react'
import { analyticsApi } from '../../../utils/api'

export function useWidgetData(spec) {
  const [state, setState] = useState({ loading: true, error: null, result: null })
  const specStr = JSON.stringify(spec)

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))
    analyticsApi
      .runQuery(spec)
      .then((result) => { if (!cancelled) setState({ loading: false, error: null, result }) })
      .catch((e) => { if (!cancelled) setState({ loading: false, error: e.message || 'Query failed', result: null }) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specStr])

  return state
}
