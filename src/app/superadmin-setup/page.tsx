"use client";

import { useState } from "react";
import Link from "next/link";
import { setupInitialSuperAdmin } from "@/lib/supabase/account-functions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export default function SuperAdminSetupPage() {
  const [setupCode, setSetupCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await setupInitialSuperAdmin({ setupCode, password });
      if (result.ok) setMessage(result.message);
      else setError(result.message);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not complete setup."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h1 className="text-xl font-bold text-slate-900">
          Create the first superadmin
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          This one-time setup creates <strong>superadmin@vc</strong>. Supabase
          uses a generated internal sign-in address; no email account or inbox
          is needed.
        </p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <Label htmlFor="setup-code">One-time setup code</Label>
            <Input
              id="setup-code"
              type="password"
              autoComplete="off"
              value={setupCode}
              onChange={(event) => setSetupCode(event.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Create password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              Use at least 12 characters.
            </p>
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              required
            />
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
              {message}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            Create superadmin
          </Button>
        </form>
        <Link
          href="/login"
          className="mt-4 block text-center text-sm font-medium text-primary hover:underline"
        >
          Return to sign in
        </Link>
      </section>
    </main>
  );
}
