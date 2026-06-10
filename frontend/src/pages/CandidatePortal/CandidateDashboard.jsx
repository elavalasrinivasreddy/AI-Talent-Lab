import React, { useState, useEffect } from 'react'
import { Card } from '../../components/shared/ui'

export default function CandidateDashboard() {
  const [data, setData] = useState(null)

  useEffect(() => {
    // Fetch timeline
  }, [])

  return (
    <div className="p-lg max-w-container mx-auto">
      <h1 className="mb-lg">My Applications</h1>
      
      <div className="grid gap-md">
        <Card title="Timeline">
          <p className="text-muted">No applications found.</p>
        </Card>
      </div>
    </div>
  )
}
