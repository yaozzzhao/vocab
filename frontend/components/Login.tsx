import React, { useState, useEffect } from 'react';
import { User } from '../types';
import * as db from '../db';
import { User as UserIcon, Lock, AlertCircle, Sparkles, ShieldQuestion, ArrowLeft, KeyRound, CheckCircle2 } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User, token: string) => void;
}

const SECURITY_QUESTIONS = [
  "What is your mother's maiden name?",
  "What was the name of your first pet?",
  "What city were you born in?",
  "What was the name of your elementary school?",
  "What is your favorite book?",
  "What is your favorite food?",
  "What was the model of your first car?",
  "What is your favorite color?",
];

function generateCaptcha(): { a: number; b: number } {
  return { a: Math.floor(Math.random() * 20) + 1, b: Math.floor(Math.random() * 20) + 1 };
}

type Page = "login" | "register" | "forgot";

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [page, setPage] = useState<Page>("login");

  // Shared
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Register fields
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [captcha, setCaptcha] = useState(generateCaptcha());
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  // Forgot password fields
  const [forgotStep, setForgotStep] = useState<"username" | "security" | "reset">("username");
  const [forgotUserId, setForgotUserId] = useState<number | null>(null);
  const [forgotQuestion, setForgotQuestion] = useState('');
  const [forgotAnswer, setForgotAnswer] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');

  useEffect(() => {
    if (page === "register") {
      if (!securityQuestion) setSecurityQuestion(SECURITY_QUESTIONS[0]);
    }
  }, [page, securityQuestion]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password.trim()) {
      setError("Username and password cannot be empty.");
      return;
    }
    setLoading(true);
    try {
      const result = await db.login(username.trim(), password);
      onLogin(result.user, result.token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError("Username and password cannot be empty.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (!securityAnswer.trim()) {
      setError("Please enter a security answer.");
      return;
    }
    const expected = captcha.a + captcha.b;
    if (parseInt(captchaAnswer, 10) !== expected) {
      setError("Incorrect captcha answer. Please try again.");
      setCaptcha(generateCaptcha());
      setCaptchaAnswer('');
      return;
    }

    setLoading(true);
    try {
      const result = await db.register(username.trim(), password, securityQuestion, securityAnswer.trim());
      onLogin(result.user, result.token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
      setCaptcha(generateCaptcha());
      setCaptchaAnswer('');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim()) {
      setError("Please enter your username.");
      return;
    }
    setLoading(true);
    try {
      const result = await db.getSecurityQuestionForUser(username.trim());
      setForgotUserId(result.userId);
      setForgotQuestion(result.question);
      setForgotStep("security");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to get security question.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!forgotAnswer.trim()) {
      setError("Please enter your security answer.");
      return;
    }
    setForgotStep("reset");
  };

  const handleForgotReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (forgotNewPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      await db.resetPassword(forgotUserId!, forgotAnswer.trim(), forgotNewPassword);
      setPage("login");
      setPassword('');
      setError(null);
      setForgotStep("username");
      setForgotUserId(null);
      setForgotQuestion('');
      setForgotAnswer('');
      setForgotNewPassword('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reset failed.');
      setForgotStep("security");
    } finally {
      setLoading(false);
    }
  };

  const resetToLogin = () => {
    setPage("login");
    setError(null);
    setForgotStep("username");
    setForgotUserId(null);
    setForgotQuestion('');
    setForgotAnswer('');
    setForgotNewPassword('');
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
            {page === "register" ? "Create your account" : page === "forgot" ? "Reset your password" : "Sign in to continue"}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-card p-6">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {page === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
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
                    Sign In
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-sm pt-1">
                <button
                  type="button"
                  onClick={() => { setPage("forgot"); setError(null); }}
                  className="text-brand-600 font-medium hover:text-brand-700 transition-colors"
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={() => { setPage("register"); setError(null); setCaptcha(generateCaptcha()); }}
                  className="text-stone-500 font-medium hover:text-stone-700 transition-colors"
                >
                  Register
                </button>
              </div>
            </form>
          )}

          {page === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
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
                  placeholder="Password (min 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all text-sm"
                  disabled={loading}
                />
              </div>

              {/* Security Question */}
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1.5 flex items-center gap-1.5">
                  <ShieldQuestion className="w-3.5 h-3.5" />
                  Security Question
                </label>
                <select
                  value={securityQuestion}
                  onChange={(e) => setSecurityQuestion(e.target.value)}
                  className="w-full px-3 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all text-sm bg-white"
                  disabled={loading}
                >
                  {SECURITY_QUESTIONS.map((q) => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-stone-400 absolute top-1/2 left-3.5 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Your answer"
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all text-sm"
                  disabled={loading}
                />
              </div>

              {/* CAPTCHA */}
              <div className="bg-stone-50 rounded-xl border border-stone-200 p-3">
                <p className="text-xs font-semibold text-stone-500 mb-2">Verification</p>
                <p className="text-sm text-stone-700 mb-2 font-medium">
                  What is {captcha.a} + {captcha.b}?
                </p>
                <input
                  type="number"
                  placeholder="Answer"
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  className="w-full px-3 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all text-sm"
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
                    Create Account
                  </>
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => { setPage("login"); setError(null); }}
                  className="text-sm text-brand-600 font-medium hover:text-brand-700 transition-colors"
                >
                  Already have an account? Sign In
                </button>
              </div>
            </form>
          )}

          {page === "forgot" && (
            <div className="space-y-4">
              {/* Back button */}
              <button
                type="button"
                onClick={resetToLogin}
                className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Sign In
              </button>

              {forgotStep === "username" && (
                <form onSubmit={handleForgotUsername} className="space-y-4">
                  <p className="text-sm text-stone-500">Enter your username to look up your security question.</p>
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
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-brand-500 text-white rounded-xl font-semibold hover:bg-brand-600 active:scale-[0.98] transition-all disabled:opacity-50 shadow-bubble flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <ShieldQuestion className="w-4 h-4" />
                        Find Security Question
                      </>
                    )}
                  </button>
                </form>
              )}

              {forgotStep === "security" && (
                <form onSubmit={handleForgotSecurity} className="space-y-4">
                  <div className="bg-brand-50 rounded-xl border border-brand-200 p-4">
                    <p className="text-xs font-semibold text-brand-700 mb-1">Security Question</p>
                    <p className="text-sm text-stone-700 font-medium">{forgotQuestion}</p>
                  </div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-stone-400 absolute top-1/2 left-3.5 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Your answer"
                      value={forgotAnswer}
                      onChange={(e) => setForgotAnswer(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all text-sm"
                      disabled={loading}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-brand-500 text-white rounded-xl font-semibold hover:bg-brand-600 active:scale-[0.98] transition-all disabled:opacity-50 shadow-bubble flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Continue
                  </button>
                </form>
              )}

              {forgotStep === "reset" && (
                <form onSubmit={handleForgotReset} className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-success-600 bg-success-50 rounded-xl p-3 border border-success-200">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Security answer accepted. Set a new password.
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-400 absolute top-1/2 left-3.5 -translate-y-1/2" />
                    <input
                      type="password"
                      placeholder="New password (min 6 characters)"
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
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
                        Reset Password
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
