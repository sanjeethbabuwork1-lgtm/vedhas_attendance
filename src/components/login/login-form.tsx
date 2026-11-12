"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { saveSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { createBrowserClient } from "@/lib/supabase/client";
import type { Role } from "@/types";
import {
  getOfflineMessage,
  isNetworkError,
} from "@/lib/network";

const loginSchema = z.object({
  employeeId: z
    .string()
    .trim()
    .min(1, "Employee ID is required")
    .refine(
      (v) => v === v.toLowerCase(),
      "Employee ID must be in lowercase only."
    ),
  password: z.string().min(1, "Enter a password"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const REMEMBER_KEY = "gfa_remember";

function loadRemembered(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(REMEMBER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "string") {
      window.localStorage.removeItem(REMEMBER_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(REMEMBER_KEY) !== null;
    } catch {
      return false;
    }
  });

const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { employeeId: "", password: "" },
  });

  useEffect(() => {
    const saved = loadRemembered();
    if (saved) {
      setValue("employeeId", saved);
    }
  }, [setValue]);

  function goToRole(role: Role) {
    router.push(
      role === "superadmin"
        ? "/superadmin"
        : role === "admin"
          ? "/admin"
          : "/staff"
    );
    router.refresh();
  }

  async function onSubmit(values: LoginFormValues) {
    setError(null);
    setLoading(true);

    const employeeId = values.employeeId.trim().toLowerCase();

    try {
      const supabase = createBrowserClient();
      if (!supabase) throw new Error("Supabase is not configured.");

      const { data: authEmail, error: lookupError } = await supabase.rpc(
        "resolve_login_email",
        { p_employee_id: employeeId }
      );
      if (lookupError) throw new Error(lookupError.message);
      if (typeof authEmail !== "string" || !authEmail) {
        setError("Employee ID or password is incorrect, or a password has not been set.");
        setLoading(false);
        return;
      }

      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: authEmail,
          password: values.password,
        });
      if (authError || !authData.user) {
        setError("Employee ID or password is incorrect.");
        setLoading(false);
        return;
      }

      const { fetchProfileByAuthUserId, buildSession } = await import(
        "@/lib/supabase/repo"
      );
      const profile = await fetchProfileByAuthUserId(authData.user.id);
      if (!profile) {
        await supabase.auth.signOut();
        setError("This account is not linked to an employee profile. Contact the superadmin.");
        setLoading(false);
        return;
      }
      saveSession(buildSession(profile));
      if (remember) {
        window.localStorage.setItem(REMEMBER_KEY, JSON.stringify(employeeId));
      } else {
        window.localStorage.removeItem(REMEMBER_KEY);
      }
      goToRole(profile.role);
    } catch (err) {
      if (isNetworkError(err)) {
        setError(getOfflineMessage());
      } else {
        setError(err instanceof Error ? err.message : "Unable to sign in.");
      }
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="employeeId">Employee ID</Label>
          <Input
            id="employeeId"
            autoComplete="username"
            placeholder="Enter your ID"
            {...register("employeeId")}
          />
          <FieldError message={errors.employeeId?.message} />
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter a password"
              className="pr-10"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:text-slate-700"
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          <FieldError message={errors.password?.message} />
        </div>

        <button
          type="button"
          role="checkbox"
          aria-checked={remember}
          onClick={() => setRemember((v) => !v)}
          className="flex w-fit cursor-pointer select-none items-center gap-2"
        >
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
              remember
                ? "border-primary bg-primary"
                : "border-slate-300 bg-white"
            )}
          />
          <span className="text-sm font-medium text-slate-600">
            Remember me
          </span>
        </button>

        {error && (
          <div className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
            {error}
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          <LogIn className="size-4" />
          Sign in
        </Button>
      </form>
    </div>
  );
}