"use client";

import { useState } from "react";
import { setAccountPassword } from "@/lib/supabase/account-functions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

export function SetAccountPasswordModal({
  employeeId,
  onClose,
  onSaved,
}: {
  employeeId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const result = await setAccountPassword(employeeId, password);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not update password."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} panelClassName="p-5">
      <h2 className="mb-1 text-base font-bold text-slate-900">Set password</h2>
      <p className="mb-4 text-sm text-slate-500">{employeeId}</p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="confirm-new-password">Confirm password</Label>
          <Input
            id="confirm-new-password"
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
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="submit" loading={saving}>
            Save password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
