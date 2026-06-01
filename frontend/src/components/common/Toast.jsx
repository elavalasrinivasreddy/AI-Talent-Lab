import { useEffect } from 'react';
import Icon from './Icon';
import './Toast.css';

export default function Toast({ message, type = 'success', onClose, duration = 3000 }) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  if (!message) return null;

  return (
    <div className={`toast-container ${type}`}>
      <div className="toast-icon">
        <Icon name={type === 'success' ? 'check-circle' : 'alert-circle'} size={18} />
      </div>
      <div className="toast-content">{message}</div>
      <button className="toast-close" onClick={onClose}>
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}
