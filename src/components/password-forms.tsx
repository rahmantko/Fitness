"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { changePassword, resetClientPassword } from "@/app/actions";
import { Field, inputCls } from "./ui";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text hover:opacity-90 disabled:opacity-60">
      {pending ? "Saving…" : children}
    </button>
  );
}

export function ChangePasswordForm({ temporary }: { temporary: boolean }) {
  const [state, action] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="max-w-sm space-y-4">
      <Field label={temporary ? "Temporary password" : "Current password"}>
        <input name="current" type="password" required autoComplete="current-password" className={inputCls} />
      </Field>
      <Field label="New password" hint="At least 8 characters">
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
      </Field>
      <Field label="Confirm new password">
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
      </Field>
      {state && (
        <p role="status" className={`text-sm ${state.error ? "text-danger" : "text-accent"}`}>
          {state.error ?? state.ok}
        </p>
      )}
      <Submit>Change password</Submit>
    </form>
  );
}

export function ResetClientPassword({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [state, action] = useActionState(resetClientPassword, undefined);
  const [copied, setCopied] = useState(false);
  if (state?.tempPassword) {
    return (
      <div className="space-y-3 text-sm">
        <p>
          {clientName}&apos;s temporary password is shown below. Send it to them privately. They&apos;ll be asked to choose
          a new password as soon as they log in. It won&apos;t be shown again.
        </p>
        <div className="flex items-center gap-2">
          <code className="rounded-lg bg-surface-2 px-3 py-2 font-mono text-base font-semibold">{state.tempPassword}</code>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard?.writeText(state.tempPassword!);
              setCopied(true);
            }}
            className="rounded-lg border border-border px-3 py-2 hover:bg-surface-2"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      </div>
    );
  }
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Reset ${clientName}'s password? Their current password will stop working.`)) e.preventDefault();
      }}
      className="space-y-3 text-sm"
    >
      <input type="hidden" name="clientId" value={clientId} />
      <p className="text-muted">
        If {clientName} forgets their password, reset it here. You&apos;ll get a temporary password to send them.
      </p>
      {state?.error && <p className="text-danger">{state.error}</p>}
      <button className="rounded-lg border border-border px-3 py-2 font-medium hover:bg-surface-2">Reset password</button>
    </form>
  );
}
