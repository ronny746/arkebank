'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Mail, KeyRound, ShieldCheck, ArrowRight, RefreshCw, CheckCircle, Sparkles } from 'lucide-react';

interface LoginFormProps {
  onSuccess: (user: any) => void;
}

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

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      setDemoOtp(data.demoOtp);
      setSuccessMsg(`OTP code sent to ${email}`);
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

    if (!otp || otp.length < 4) {
      setError('Please enter the 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid OTP');
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
            <Image
              src="/logo.png"
              alt="ARKE SCHOLARS Logo"
              width={220}
              height={80}
              priority
              style={{ objectFit: 'contain', width: 'auto', height: '65px' }}
            />
          </div>
          <h2 className="login-title">Assessment Intelligence Portal</h2>
          <p className="login-subtitle">
            Secure login to explore 5,27,000+ standardized questions, solutions, and diagrams.
          </p>
        </div>

        {error && (
          <div className="alert-box alert-error">
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="alert-box alert-success">
            <CheckCircle size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleSendOtp} className="login-form">
            <div className="form-group">
              <label htmlFor="email" className="form-label">Work or Academic Email</label>
              <div className="input-group">
                <Mail className="input-icon" size={18} />
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="name@school.edu or name@arkescholars.com"
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
                  <span>Sending Verification Code...</span>
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
          <form onSubmit={handleVerifyOtp} className="login-form">
            {/* Demo Helper Toast */}
            {demoOtp && (
              <div className="demo-otp-banner">
                <div className="demo-otp-header">
                  <Sparkles size={16} className="text-emerald" />
                  <span>Your One-Time Passcode (OTP):</span>
                </div>
                <div className="demo-otp-code">{demoOtp}</div>
                <small className="demo-otp-hint">You can also use master demo OTP: <b>123456</b></small>
              </div>
            )}

            <div className="form-group">
              <div className="flex-between">
                <label htmlFor="otp" className="form-label">Enter 6-Digit OTP</label>
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
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  <span>Verify & Access Question Bank</span>
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
                Didn't receive code? Resend OTP
              </button>
            </div>
          </form>
        )}

        <div className="login-footer">
          <div className="security-badge">
            <ShieldCheck size={14} className="text-navy" />
            <span>Encrypted Token-Based Scholar Authentication</span>
          </div>
        </div>
      </div>
    </div>
  );
}
