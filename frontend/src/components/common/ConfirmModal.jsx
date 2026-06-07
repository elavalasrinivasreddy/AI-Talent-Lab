import React, { useState } from 'react'

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', confirmVariant = 'danger' }) {
  const [confirming, setConfirming] = useState(false)

  if (!isOpen) return null

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      await onConfirm()
      onClose()
    } catch {
      // Parent handles error display; don't close so the user sees the error
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={confirming ? undefined : onClose} style={{ zIndex: 9999 }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', minHeight: 'auto', textAlign: 'center', padding: 'var(--space-6)' }}>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: confirmVariant === 'danger' ? 'var(--color-danger-bg)' : 'var(--color-primary-bg)',
            color: confirmVariant === 'danger' ? 'var(--color-danger)' : 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)',
            fontSize: '24px'
          }}>
            {confirmVariant === 'danger' ? '⚠️' : '❓'}
          </div>
          <h3 style={{ margin: '0 0 var(--space-2)', fontSize: '18px', color: 'var(--color-text-primary)' }}>{title}</h3>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{message}</p>
        </div>
        <div className="btn-row" style={{ justifyContent: 'center', marginTop: 'var(--space-6)' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={confirming}>Cancel</button>
          <button
            className={`btn ${confirmVariant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleConfirm}
            disabled={confirming}
          >
            {confirming ? 'Please wait…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
