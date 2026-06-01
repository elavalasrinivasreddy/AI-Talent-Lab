import React, { useEffect } from 'react';
import Icon from './Icon';

export default function SlideOver({ isOpen, onClose, title, children, width = 500 }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="slideover-overlay" onClick={onClose}>
      <div 
        className="slideover-content" 
        style={{ width: `${width}px` }} 
        onClick={e => e.stopPropagation()}
      >
        <div className="slideover-header">
          <h2>{title}</h2>
          <button className="slideover-close" onClick={onClose}>
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className="slideover-body">
          {children}
        </div>
      </div>
    </div>
  );
}
