/**
 * LoginForm Component
 * Handles OwnTracks authentication
 */

import { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';

export default function LoginForm({ onLogin, isVisible }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [serverurl, setServerurl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await onLogin(username, password, serverurl);
    } finally {
      setLoading(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full mx-4">
        <h3 className="text-2xl font-bold mb-6 text-neutral-900">
          Enter OwnTrack Login and URL
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="text"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div>
            <Input
              type="password"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <div>
            <Input
              type="url"
              placeholder="https://[your domain]"
              value={serverurl}
              onChange={(e) => setServerurl(e.target.value)}
              required
              autoComplete="url"
            />
          </div>

          <Button
            type="submit"
            variant="success"
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </form>
      </div>
    </div>
  );
}
