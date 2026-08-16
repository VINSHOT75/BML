import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

const SCRIPT_ID = 'google-identity-services';

export default function GoogleSignInModal({ open, onClose, onCredential }) {
  const buttonRef = useRef(null);
  const initializedRef = useRef(false);
  const [error, setError] = useState('');
  const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

  const renderButton = useCallback(() => {
    if (!open || !clientId || !window.google || !buttonRef.current) return;

    buttonRef.current.innerHTML = '';
    if (!initializedRef.current) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          try {
            setError('');
            await onCredential(credential);
          } catch (loginError) {
            setError(loginError.response?.data?.detail || 'Google sign-in failed. Please try again.');
          }
        },
      });
      initializedRef.current = true;
    }
    window.google.accounts.id.renderButton(buttonRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: 320,
    });
  }, [clientId, onCredential, open]);

  useEffect(() => {
    if (!open || !clientId) return undefined;

    const existingScript = document.getElementById(SCRIPT_ID);
    if (existingScript) {
      if (window.google) renderButton();
      else existingScript.addEventListener('load', renderButton, { once: true });
      return () => existingScript.removeEventListener('load', renderButton);
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = renderButton;
    script.onerror = () => setError('Could not load Google Sign-In. Check your connection.');
    document.head.appendChild(script);
    return undefined;
  }, [clientId, open, renderButton]);

  useEffect(() => {
    if (!open) setError('');
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#071512]/80 px-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="google-signin-title">
      <div className="relative w-full max-w-md rounded-[1.75rem] border border-[#17231f]/10 bg-[#f7f8f3] p-8 text-center shadow-2xl sm:p-10">
        <button onClick={onClose} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-[#e8ede6] text-[#61736d] hover:text-[#17231f]" aria-label="Close sign-in dialog">
          <X className="h-5 w-5" />
        </button>
        <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-[#17231f] text-[#d8ff61]"><span className="text-xl font-black">B</span></div>
        <h2 id="google-signin-title" className="mb-2 font-heading text-2xl font-extrabold text-[#17231f]">Welcome to BookMyLoad</h2>
        <p className="mb-7 text-sm text-[#6d7e78]">Continue securely with the Google account linked to your organization.</p>
        {clientId ? (
          <div ref={buttonRef} className="flex min-h-11 justify-center" />
        ) : (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
            Google Sign-In needs a client ID. Set REACT_APP_GOOGLE_CLIENT_ID to enable it.
          </p>
        )}
        {error && <p className="mt-4 text-sm text-red-400" role="alert">{error}</p>}
      </div>
    </div>
  );
}
