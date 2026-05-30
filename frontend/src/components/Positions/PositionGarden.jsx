import React from 'react'
import PositionCard from './PositionCard'
import SkeletonCard from '../common/SkeletonCard'

export default function PositionGarden({ positions, loading, onOpen }) {
  if (loading) {
    return (
      <div className="positions-garden-grid">
        {[1, 2, 3, 4].map(i => <SkeletonCard key={i} lines={5} height={280} />)}
      </div>
    )
  }
  return (
    <div className="positions-garden-grid">
      {positions.map(p => (
        <PositionCard key={p.id} position={p} onOpen={onOpen} />
      ))}
    </div>
  )
}
