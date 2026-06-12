import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, Button, Chip } from '../components/shared/ui'

export default function Careers() {
  const { orgId } = useParams()
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // In a real app, we would fetch open positions for this org
    // For now, we'll just mock it or leave it empty as a skeleton
    setLoading(false)
  }, [orgId])

  if (loading) return (
    <div className="bg-subtle min-h-screen">
      <header className="bg-white border-b py-xl text-center">
        <div className="skeleton-line w-64 mx-auto h-8 mb-4"></div>
        <div className="skeleton-line w-48 mx-auto h-4"></div>
      </header>
      <main className="max-w-container mx-auto p-xl">
        <div className="skeleton-line w-48 h-6 mb-lg"></div>
        <div className="grid gap-md">
          <Card className="p-xl"><div className="skeleton-line w-full h-16"></div></Card>
          <Card className="p-xl"><div className="skeleton-line w-full h-16"></div></Card>
          <Card className="p-xl"><div className="skeleton-line w-full h-16"></div></Card>
        </div>
      </main>
    </div>
  )

  return (
    <div className="bg-subtle min-h-screen">
      <header className="bg-white border-b py-xl text-center">
        <h1>Join Our Team</h1>
        <p className="text-muted mt-sm">Help us build the future.</p>
      </header>

      <main className="max-w-container mx-auto p-xl">
        <h2 className="mb-lg">Open Positions</h2>
        {positions.length === 0 ? (
          <Card className="text-center p-xl">
            <p className="text-muted">No open positions at the moment. Check back later!</p>
          </Card>
        ) : (
          <div className="grid gap-md">
            {positions.map(p => (
              <Card key={p.id}>
                <div className="row justify-between align-center">
                  <div>
                    <h3 className="mb-xs">{p.title}</h3>
                    <div className="row gap-sm text-sm text-muted">
                      <span>{p.location}</span>
                      <span>•</span>
                      <span>{p.type}</span>
                    </div>
                  </div>
                  <Button variant="primary">Apply Now</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
