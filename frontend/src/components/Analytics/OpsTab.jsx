import { useState, useEffect } from 'react'
import { dashboardApi } from '../../utils/api'
import CeleryHealthCard from './CeleryHealthCard'
import LLMCostCard      from './LLMCostCard'
import JDMetricsCard    from './JDMetricsCard'
import './OpsTab.css'

function useOpsData(period) {
  const [celery,  setCelery]  = useState(null)
  const [llm,     setLLM]     = useState(null)
  const [jd,      setJD]      = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.allSettled([
      dashboardApi.getCeleryStats(period),
      dashboardApi.getLLMStats(period),
      dashboardApi.getJDStats(period),
    ]).then(([celeryRes, llmRes, jdRes]) => {
      if (celeryRes.status === 'fulfilled') setCelery(celeryRes.value)
      if (llmRes.status    === 'fulfilled') setLLM(llmRes.value)
      if (jdRes.status     === 'fulfilled') setJD(jdRes.value)
    }).finally(() => setLoading(false))
  }, [period])

  return { celery, llm, jd, loading }
}

export default function OpsTab({ period }) {
  const { celery, llm, jd, loading } = useOpsData(period)

  return (
    <div className="ops-tab">
      <div className="ops-row-2col">
        <CeleryHealthCard data={celery} loading={loading} />
        <LLMCostCard      data={llm}    loading={loading} />
      </div>
      <JDMetricsCard data={jd} loading={loading} />
    </div>
  )
}
