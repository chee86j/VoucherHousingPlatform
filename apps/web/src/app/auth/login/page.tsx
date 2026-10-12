'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'password' | 'verify' | 'enroll';
export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [secret, setSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function post(action: string, body: object) {
    const response = await fetch(`/api/session/${action}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      cache: 'no-store', body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Sign-in failed');
    return result;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (step === 'password') {
        const result = await post('login', { email, password });
        setPassword(''); // Password is never retained past the first request.
        if (result.requiresMfa) {
          setStep(result.requiresEnrollment ? 'enroll' : 'verify');
          if (result.requiresEnrollment) {
            const enrollment = await post('mfa/bootstrap', {});
            setSecret(enrollment.secret);
            setOtpauthUrl(enrollment.otpauthUrl);
          }
          return;
        }
      } else {
        await post(step === 'enroll' ? 'mfa/bootstrap/confirm' : 'mfa/verify', { totpCode });
      }
      setSecret('');
      setOtpauthUrl('');
      setTotpCode('');
      router.replace('/console');
      router.refresh();
    } catch (cause) {
      setPassword('');
      setError(cause instanceof Error ? cause.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h1 className="text-center text-2xl font-bold text-slate-900">VoucherHousingPlatform</h1>
        <h2 className="mt-4 text-center text-xl text-slate-600">{step === 'password' ? 'Sign in to your account' : step === 'enroll' ? 'Set up authenticator MFA' : 'Verify your sign-in'}</h2>
      </div>
      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <form className="space-y-6" onSubmit={submit}>
          {error && <p role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</p>}
          {step === 'password' ? <>
            <div><label htmlFor="email" className="block text-sm font-medium text-slate-900">Email address</label>
              <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 block w-full rounded-md px-3 py-2 text-slate-900 ring-1 ring-slate-300" /></div>
            <div><label htmlFor="password" className="block text-sm font-medium text-slate-900">Password</label>
              <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 block w-full rounded-md px-3 py-2 text-slate-900 ring-1 ring-slate-300" /></div>
          </> : <>
            {step === 'enroll' && <div className="space-y-2 text-sm text-slate-700">
              <p>Add this secret to your authenticator app, then enter its six-digit code. Keep the secret private; it is only shown during enrollment.</p>
              {secret && <p className="break-all rounded bg-slate-100 p-3"><span className="font-medium">Setup secret: </span><code>{secret}</code></p>}
              {otpauthUrl && <p className="break-all"><span className="font-medium">Authenticator URI: </span><code>{otpauthUrl}</code></p>}
            </div>}
            <div><label htmlFor="totpCode" className="block text-sm font-medium text-slate-900">Six-digit authenticator code</label>
              <input id="totpCode" name="totpCode" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={totpCode} onChange={(e) => setTotpCode(e.target.value)} className="mt-2 block w-full rounded-md px-3 py-2 text-slate-900 ring-1 ring-slate-300" /></div>
          </>}
          <button type="submit" disabled={loading || (step === 'enroll' && !secret)} className="flex w-full justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 disabled:opacity-50">{loading ? 'Please wait…' : step === 'password' ? 'Sign in' : step === 'enroll' ? 'Complete setup' : 'Verify code'}</button>
        </form>
        {step !== 'password' && <button type="button" onClick={() => { setStep('password'); setSecret(''); setOtpauthUrl(''); setTotpCode(''); setError(''); }} className="mt-4 text-sm text-primary-600 underline">Start over</button>}
      </div>
    </main>
  );
}
