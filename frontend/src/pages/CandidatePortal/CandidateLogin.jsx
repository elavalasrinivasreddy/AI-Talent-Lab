import React, { useState } from 'react'
import { Card, Input, Button } from '../../components/shared/ui'

export default function CandidateLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    // Implement login logic
  }

  return (
    <div className="login-page">
      <Card title="Candidate Portal Login" style={{ maxWidth: 400, margin: '40px auto' }}>
        <form onSubmit={handleLogin}>
          <Input 
            label="Email" 
            type="email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            required 
          />
          <Input 
            label="Password" 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
            className="mt-md"
          />
          <Button variant="primary" type="submit" className="mt-lg w-full">Login</Button>
        </form>
      </Card>
    </div>
  )
}
