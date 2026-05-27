import React, { useState } from 'react';
import { User } from '../types';
import * as db from '../db';
import { User as UserIcon, Lock, AlertCircle, Sparkles } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User, token: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError("Username and password cannot be empty.");
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        const { user, token } = await db.register(username.trim(), password);
        onLogin(user, token);
      } else {
        const { user, token } = await db.login(username.trim(), password);
        onLogin(user, token);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-bubble">
            <span className="text-3xl font-bold text-white">V</span>
          </div>
          <h1 className="text-3xl font-bold text-stone-800">VocabMaster</h1>
          <p className="text-stone-400 mt-1">
            {isRegister ? "Create your account" : "Sign in to continue"}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-card p-6">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <UserIcon className="w-4 h-4 text-stone-400 absolute top-1/2 left-3.5 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-3 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all text-sm"
                disabled={loading}
              />
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-stone-400 absolute top-1/2 left-3.5 -translate-y-1/2" />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all text-sm"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-500 text-white rounded-xl font-semibold hover:bg-brand-600 active:scale-[0.98] transition-all disabled:opacity-50 shadow-bubble flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {isRegister ? 'Create Account' : 'Sign In'}
                </>
              )}
            </button>
          </form>

          <div className="text-center mt-6">
            <button
              onClick={() => { setIsRegister(!isRegister); setError(null); }}
              className="text-sm text-brand-600 font-medium hover:text-brand-700 transition-colors"
            >
              {isRegister
                ? 'Already have an account? Sign In'
                : "Don't have an account? Register"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};