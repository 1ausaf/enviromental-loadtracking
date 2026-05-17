"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { captureLocation } from "@/lib/geo-client";

type Stage = "credentials" | "setup" | "verify";

type SetupData = {
  qrDataUrl: string;
  otpAuthUrl: string;
  secret: string;
};

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Login failed.");
        return;
      }
      if (json.stage === "setup") {
        const setupRes = await fetch("/api/auth/totp/setup", { method: "POST" });
        const setupJson = await setupRes.json();
        if (!setupRes.ok) {
          setError(setupJson.error ?? "2FA setup failed.");
          return;
        }
        setSetup(setupJson);
        setStage("setup");
      } else {
        setStage("verify");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const geo = await captureLocation();
      const res = await fetch("/api/auth/totp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, geo }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Verification failed.");
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (stage === "credentials") {
    return (
      <form onSubmit={submitCredentials} className="space-y-4">
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={setEmail}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={setPassword}
        />
        {error ? <ErrorBox>{error}</ErrorBox> : null}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 w-full items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {busy ? "Checking…" : "Continue"}
        </button>
        <p className="text-center text-sm text-zinc-600">
          <Link href="/forgot-password" className="underline hover:text-zinc-900">
            Forgot password?
          </Link>
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={submitCode} className="space-y-4">
      {stage === "setup" && setup ? (
        <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-sm text-zinc-700">
            First-time setup. Scan this QR code in your authenticator app
            (Google Authenticator, Microsoft Authenticator, 1Password, etc.),
            then enter the 6-digit code below.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={setup.qrDataUrl}
            alt="2FA setup QR code"
            className="mx-auto h-48 w-48 rounded bg-white p-2"
          />
          <details className="text-xs text-zinc-600">
            <summary className="cursor-pointer">Can&apos;t scan? Show the secret</summary>
            <code className="mt-2 block break-all rounded bg-white p-2 font-mono text-xs">
              {setup.secret}
            </code>
          </details>
        </div>
      ) : (
        <p className="text-sm text-zinc-600">
          Enter the 6-digit code from your authenticator app.
        </p>
      )}

      <Field
        id="code"
        label="6-digit code"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        required
        value={code}
        onChange={setCode}
      />
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-11 w-full items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        {busy
          ? "Verifying…"
          : stage === "setup"
            ? "Enable 2FA & sign in"
            : "Sign in"}
      </button>
      <p className="text-xs text-zinc-500">
        Sign-in location is recorded with this session (proposal §2.1). The
        browser will ask for permission.
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  inputMode,
  pattern,
  required,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  inputMode?: "numeric";
  pattern?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-zinc-900">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        pattern={pattern}
        required={required}
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      />
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {children}
    </div>
  );
}
