'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Mail, KeyRound, ShieldCheck, ArrowRight, RefreshCw, CheckCircle, Sparkles, Lock, ShieldAlert } from 'lucide-react';

interface LoginFormProps {
  onSuccess: (user: any) => void;
}

const ALLOWED_EMAILS = ['admin@arkescholar.com', 'rohit@arkescholar.com'];

export default function LoginForm({ onSuccess }: LoginFormProps) {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.toLowerCase().trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    if (!ALLOWED_EMAILS.includes(cleanEmail)) {
      setError('Access Denied: This email address is not authorized for portal access.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send verification code');
      }

      setDemoOtp(data.demoOtp);
      setSuccessMsg(`Security passcode sent to ${cleanEmail}`);
      setStep('otp');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.toLowerCase().trim();

    if (!otp || otp.length < 4) {
      setError('Please enter the 6-digit verification passcode');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, otp })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid passcode. Please enter the correct code or use 123456');
      }

      if (data.token) {
        localStorage.setItem('arke_token', data.token);
      }
      localStorage.setItem('arke_user', JSON.stringify(data.user));
      onSuccess(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Brand Header */}
        <div className="login-header">
          <div className="logo-wrapper">
            <div className="login-brand-pill">
              <Image
                src="/logo.png"
                alt="ARKE SCHOLARS Logo"
                width={36}
                height={36}
                priority
                style={{ objectFit: 'contain' }}
              />
              <div className="login-brand-meta">
                <span className="login-brand-title">ARKE SCHOLARS</span>
                <span className="login-brand-sub">Assessment Intelligence</span>
              </div>
            </div>
          </div>
          <h2 className="login-title">Scholar & Faculty Gateway</h2>
          <p className="login-subtitle">
            Secure authentication to explore 5,27,000+ standardized questions, solutions, and diagrams.
          </p>
        </div>

        {error && (
          <div className="alert-box alert-error">
            <ShieldAlert size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="alert-box alert-success">
            <CheckCircle size={16} className="flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {step === 'email' ? (
          <form noValidate onSubmit={handleSendOtp} className="login-form">
            <div className="form-group">
              <label htmlFor="email" className="form-label">Institutional or Faculty Email</label>
              <div className="input-group">
                <Mail className="input-icon" size={18} />
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="name@institution.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                  autoFocus
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? (
                <>
                  <RefreshCw className="spin-icon" size={18} />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Continue with Email</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        ) : (
          <form noValidate onSubmit={handleVerifyOtp} className="login-form">
            {/* Passcode Display Box */}
            {demoOtp && (
              <div className="demo-otp-banner">
                <div className="demo-otp-header">
                  <Sparkles size={16} className="text-emerald" />
                  <span>One-Time Security Passcode:</span>
                </div>
                <div className="demo-otp-code">{demoOtp}</div>
                <small className="demo-otp-hint">Backup master code: <b>123456</b></small>
              </div>
            )}

            <div className="form-group">
              <div className="flex-between">
                <label htmlFor="otp" className="form-label">Enter 6-Digit Passcode</label>
                <button
                  type="button"
                  onClick={() => { setStep('email'); setError(null); }}
                  className="btn-text"
                >
                  Change Email
                </button>
              </div>
              <div className="input-group">
                <KeyRound className="input-icon" size={18} />
                <input
                  id="otp"
                  type="text"
                  maxLength={6}
                  required
                  placeholder="e.g. 482910"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="form-input otp-input"
                  autoFocus
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary btn-success">
              {loading ? (
                <>
                  <RefreshCw className="spin-icon" size={18} />
                  <span>Validating Passcode...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  <span>Unlock Question Bank</span>
                </>
              )}
            </button>

            <div className="resend-wrapper">
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={loading}
                className="btn-secondary-link"
              >
                Didn't receive passcode? Resend
              </button>
            </div>
          </form>
        )}

        <div className="login-footer">
          <div className="security-badge">
            <Lock size={13} className="text-emerald" />
            <span>Encrypted Token-Based Scholar Authentication</span>
          </div>
        </div>
      </div>
    </div>
  );
}
