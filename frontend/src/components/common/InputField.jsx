import React from 'react'

/**
 * Lightweight labelled input used by settings tabs (e.g. ProvidersTab).
 * Keeps markup consistent with the rest of the settings forms.
 */
export default function InputField({ label, value, onChange, placeholder, type = 'text', disabled = false, ...rest }) {
  return (
    <div className="form-group">
      {label && <label>{label}</label>}
      <input
        className="form-input"
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        {...rest}
      />
    </div>
  )
}
