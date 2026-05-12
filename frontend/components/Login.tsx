import React, { useState } from 'react';
import { User } from '../types';
import * as db from '../db';
import { hashPassword, verifyPassword } from '../auth';
import { User as UserIcon, Lock, AlertCircle } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError("Username and password cannot be empty.");
      return;
    }

    if (isRegister) {
      // Handle Registration
      const existingUser = await db.getUser(username);
      if (existingUser) {
        setError("Username already exists. Please choose another one.");
        return;
      }
      const passwordHash = await hashPassword(password);
      await db.addUser({ username, passwordHash, role: 'user' });
      const newUser = await db.getUser(username);
      if (newUser) {
        onLogin(newUser);
      } else {
        setError("Registration failed. Please try again.");
      }
    } else {
      // Handle Login
      const user = await db.getUser(username);
      if (!user) {
        setError("Invalid username or password.");
        return;
      }
      const isPasswordValid = await verifyPassword(password, user.passwordHash);
      if (isPasswordValid) {
        onLogin(user);
      } else {
        setError("Invalid username or password.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white p-8 rounded-xl border border-stone-200 shadow-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-serif font-bold text-stone-900">VocabMaster</h1>
          <p className="text-stone-500 mt-2">{isRegister ? "Create a new account" : "Welcome back! Please sign in."}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <UserIcon className="w-5 h-5 text-stone-400 absolute top-1/2 left-3 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full pl-10 pr-3 py-3 border border-stone-300 rounded-md focus:ring-slate-500 focus:border-slate-500"
            />
          </div>
          <div className="relative">
            <Lock className="w-5 h-5 text-stone-400 absolute top-1/2 left-3 -translate-y-1/2" />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-3 py-3 border border-stone-300 rounded-md focus:ring-slate-500 focus:border-slate-500"
            />
          </div>
          <div>
            <button
              type="submit"
              className="w-full py-3 bg-slate-800 text-white rounded-md font-medium hover:bg-slate-900 transition-colors"
            >
              {isRegister ? 'Register' : 'Sign In'}
            </button>
          </div>
        </form>

        <div className="text-center mt-6">
          <button onClick={() => { setIsRegister(!isRegister); setError(null); }} className="text-sm text-slate-600 hover:underline">
            {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register"}
          </button>
        </div>
      </div>
    </div>
  );
};
