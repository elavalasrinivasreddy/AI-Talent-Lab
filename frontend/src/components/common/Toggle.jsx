import React from 'react';
import './Toggle.css';

export default function Toggle({ checked, onChange, disabled }) {
  return (
    <label className={`st-toggle ${disabled ? 'disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="st-toggle-slider"></span>
    </label>
  );
}
