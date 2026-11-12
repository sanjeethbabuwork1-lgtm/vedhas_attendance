import type { Profile } from "@/types";
import { createBrowserClient } from "./client";

type FunctionResult = {
  ok: boolean;
  message: string;
  profile?: Profile;
};

function isFunctionResult(value: unknown): value is FunctionResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    typeof value.ok === "boolean" &&
    "message" in value &&
    typeof value.message === "string"
  );
}

async function invokeAccountFunction(
  body: Record<string, string>
): Promise<FunctionResult> {
  const supabase = createBrowserClient();
  if (!supabase) {
    return { ok: false, message: "Supabase is not configured." };
  }

  const { data, error } = await supabase.functions.invoke("manage-accounts", {
    body,
  });
  if (error) {
    if (error.context instanceof Response) {
      try {
        const responseBody: unknown = await error.context.json();
        if (isFunctionResult(responseBody)) return responseBody;
      } catch {
        return { ok: false, message: error.message };
      }
    }
    return { ok: false, message: error.message };
  }
  if (!isFunctionResult(data)) {
    return { ok: false, message: "The account service returned an invalid response." };
  }
  return data;
}

export async function setupInitialSuperAdmin(input: {
  setupCode: string;
  password: string;
}): Promise<{ ok: boolean; message: string }> {
  return invokeAccountFunction({
    action: "setup-superadmin",
    setupCode: input.setupCode,
    password: input.password,
  });
}

export async function setAccountPassword(
  employeeId: string,
  password: string
): Promise<{ ok: boolean; message: string }> {
  return invokeAccountFunction({
    action: "set-password",
    employeeId,
    password,
  });
}

export async function createStaffAccount(input: {
  fullName: string;
  employeeId: string;
  designation: string;
  password: string;
}): Promise<
  | { ok: true; message: string; profile: Profile }
  | { ok: false; message: string }
> {
  const result = await invokeAccountFunction({
    action: "create-staff",
    fullName: input.fullName,
    employeeId: input.employeeId,
    designation: input.designation,
    password: input.password,
  });
  if (!result.ok) return { ok: false, message: result.message };
  if (!result.profile) {
    return { ok: false, message: "The account service did not return the new profile." };
  }
  return { ok: true, message: result.message, profile: result.profile };
}

export async function removeStaffAccount(
  employeeId: string
): Promise<{ ok: boolean; message: string }> {
  return invokeAccountFunction({ action: "remove-staff", employeeId });
}
