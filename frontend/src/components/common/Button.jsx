import React from 'react'

export default function Button({ children, onClick, type = 'button', variant = 'primary', disabled = false, loading = false, className = '', ...rest }) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} ${className}`}
      onClick={onClick}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? 'Saving…' : children}
    </button>
  )
}
