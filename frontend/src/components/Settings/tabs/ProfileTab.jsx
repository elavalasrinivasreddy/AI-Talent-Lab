import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import api from '../../../utils/api'

function EyeIcon({ visible, onClick }) {
  return (
    <button type="button" className="password-toggle" onClick={onClick} tabIndex={-1}>
      {visible ? '🙈' : '👁️'}
    </button>
  )
}

function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div className="password-field">
      <input type={show ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} />
      <EyeIcon visible={show} onClick={() => setShow(!show)} />
    </div>
  )
}

export default function ProfileTab() {
  const { user, refreshUser } = useAuth()
  const [form, setForm] = useState({ name: '', phone: '', timezone: 'Asia/Kolkata' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const [pwForm, setPwForm] = useState({ current: '', new_password: '', confirm: '' })
  const [pwMsg, setPwMsg] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        phone: user.phone || '',
        timezone: user.timezone || 'Asia/Kolkata',
      })
    }
  }, [user])

  const handleSave = async () => {
    setSaving(true); setMsg('')
    try {
      const res = await api.patch('/auth/profile', form)
      setMsg('Profile updated!')
      if (refreshUser) refreshUser()
    } catch (e) {
      setMsg(e.message || 'Failed to save')
    }
    setSaving(false)
  }

  const handleChangePw = async () => {
    setPwSaving(true); setPwMsg('')
    if (pwForm.new_password !== pwForm.confirm) {
      setPwMsg('Passwords do not match'); setPwSaving(false); return
    }
    if (pwForm.new_password.length < 8) {
      setPwMsg('Password must be at least 8 characters'); setPwSaving(false); return
    }
    try {
      await api.post('/auth/change-password', {
        current_password: pwForm.current,
        new_password: pwForm.new_password,
      })
      setPwMsg('Password changed!')
      setPwForm({ current: '', new_password: '', confirm: '' })
    } catch (e) {
      setPwMsg(e.message || 'Failed to change password')
    }
    setPwSaving(false)
  }

  return (
    <div className="settings-form">
      <div className="settings-form-section">
        <h3>👤 My Profile</h3>
        <div className="form-row">
          <div className="form-group">
            <label>Full Name</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input value={user?.email || ''} disabled />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Role</label>
            <input value={user?.role || ''} disabled />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                   placeholder="+91 XXXXX XXXXX" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Timezone</label>
            <select value={form.timezone} onChange={e => setForm({...form, timezone: e.target.value})}>
              <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </div>
        {msg && <p className={`form-msg ${msg.includes('updated') ? 'success' : 'error'}`}>{msg}</p>}
        <div className="btn-row">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>

      <div className="settings-form-section">
        <h3>🔑 Change Password</h3>
        <div className="form-row">
          <div className="form-group">
            <label>Current Password</label>
            <PasswordInput value={pwForm.current}
                   onChange={e => setPwForm({...pwForm, current: e.target.value})} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>New Password</label>
            <PasswordInput value={pwForm.new_password}
                   onChange={e => setPwForm({...pwForm, new_password: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Confirm Password</label>
            <PasswordInput value={pwForm.confirm}
                   onChange={e => setPwForm({...pwForm, confirm: e.target.value})} />
          </div>
        </div>
        {pwMsg && <p className={`form-msg ${pwMsg.includes('changed') ? 'success' : 'error'}`}>{pwMsg}</p>}
        <div className="btn-row">
          <button className="btn btn-primary" onClick={handleChangePw} disabled={pwSaving}>
            {pwSaving ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </div>
    </div>
  )
}
