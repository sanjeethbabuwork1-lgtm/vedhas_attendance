import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPERADMIN_ID = "superadmin@vc";
const MIN_PASSWORD_LENGTH = 12;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RequestBody = {
  action?: string;
  setupCode?: string;
  employeeId?: string;
  fullName?: string;
  designation?: string;
  password?: string;
};

function reply(
  body: { ok: boolean; message: string; profile?: unknown },
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > 128) return "Password must be 128 characters or fewer.";
  return null;
}

function createInternalEmail(): string {
  return `${crypto.randomUUID().replace(/-/g, "")}@accounts.example.com`;
}

function constantTimeEqual(supplied: string, expected: string): boolean {
  let mismatch = supplied.length ^ expected.length;
  const length = Math.max(supplied.length, expected.length);
  for (let index = 0; index < length; index++) {
    mismatch |=
      (supplied.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase Edge Function credentials are missing.");
  return createClient(url, key, {
    db: { schema: "vc" },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function requireSuperAdmin(request: Request, service: ReturnType<typeof getServiceClient>) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!token || !url || !anonKey) {
    throw new Error("Please sign in again.");
  }

  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) {
    throw new Error("Your session is invalid or expired. Please sign in again.");
  }

  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("role")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (profile?.role !== "superadmin") {
    throw new Error("Only the superadmin can manage accounts.");
  }
  return service;
}

async function createAuthUser(
  service: ReturnType<typeof getServiceClient>,
  employeeId: string,
  password: string
) {
  const email = createInternalEmail();
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { employee_id: employeeId },
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? "Could not create the account.");
  }
  return { user: data.user, email };
}

async function removeCreatedUser(
  service: ReturnType<typeof getServiceClient>,
  userId: string,
  message: string
): Promise<never> {
  const { error } = await service.auth.admin.deleteUser(userId);
  if (error) throw new Error(`${message}. Account cleanup also failed: ${error.message}`);
  throw new Error(message);
}

async function setupSuperAdmin(
  service: ReturnType<typeof getServiceClient>,
  body: RequestBody
) {
  const expectedCode = Deno.env.get("SUPERADMIN_SETUP_CODE");
  if (!expectedCode) {
    return reply(
      { ok: false, message: "Initial setup is not enabled. Configure SUPERADMIN_SETUP_CODE." },
      503
    );
  }
  if (expectedCode.length < 32) {
    return reply(
      { ok: false, message: "SUPERADMIN_SETUP_CODE must contain at least 32 characters." },
      503
    );
  }
  if (
    typeof body.setupCode !== "string" ||
    !constantTimeEqual(body.setupCode, expectedCode)
  ) {
    return reply({ ok: false, message: "The setup code is incorrect." });
  }
  if (typeof body.password !== "string") {
    return reply({ ok: false, message: "Password is required." });
  }
  const passwordError = validatePassword(body.password);
  if (passwordError) return reply({ ok: false, message: passwordError });

  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("auth_user_id")
    .eq("employee_id", SUPERADMIN_ID)
    .maybeSingle();
  if (profileError) return reply({ ok: false, message: profileError.message }, 500);
  if (!profile) {
    return reply(
      { ok: false, message: "Apply the superadmin database migration first." },
      409
    );
  }
  if (profile.auth_user_id) {
    return reply({ ok: false, message: "Initial superadmin setup has already been completed." });
  }

  const { user, email } = await createAuthUser(service, SUPERADMIN_ID, body.password);
  const { data: linked, error: updateError } = await service
    .from("profiles")
    .update({ auth_user_id: user.id, auth_email: email })
    .eq("employee_id", SUPERADMIN_ID)
    .is("auth_user_id", null)
    .select("employee_id")
    .maybeSingle();
  if (updateError || !linked) {
    await removeCreatedUser(
      service,
      user.id,
      updateError?.message ?? "Superadmin setup was completed concurrently."
    );
  }

  return reply({
    ok: true,
    message: "Superadmin account created. Sign in with superadmin@vc and the password you just set.",
  });
}

async function setAccountPassword(
  service: ReturnType<typeof getServiceClient>,
  body: RequestBody
) {
  const employeeId = body.employeeId?.trim();
  if (!employeeId) return reply({ ok: false, message: "Employee ID is required." });
  if (typeof body.password !== "string") {
    return reply({ ok: false, message: "Password is required." });
  }
  const passwordError = validatePassword(body.password);
  if (passwordError) return reply({ ok: false, message: passwordError });

  const { data: profile, error } = await service
    .from("profiles")
    .select("employee_id, role, auth_user_id")
    .eq("employee_id", employeeId)
    .maybeSingle();
  if (error) return reply({ ok: false, message: error.message }, 500);
  if (!profile) return reply({ ok: false, message: "Employee profile was not found." });
  if (profile.role === "superadmin" && profile.employee_id !== SUPERADMIN_ID) {
    return reply({ ok: false, message: "This account cannot be changed here." });
  }

  if (profile.auth_user_id) {
    const { error: updateError } = await service.auth.admin.updateUserById(
      profile.auth_user_id,
      { password: body.password }
    );
    if (updateError) return reply({ ok: false, message: updateError.message }, 400);
    return reply({ ok: true, message: `Password updated for ${profile.employee_id}.` });
  }

  const { user, email } = await createAuthUser(service, profile.employee_id, body.password);
  const { data: linked, error: linkError } = await service
    .from("profiles")
    .update({ auth_user_id: user.id, auth_email: email })
    .eq("employee_id", profile.employee_id)
    .is("auth_user_id", null)
    .select("employee_id")
    .maybeSingle();
  if (linkError || !linked) {
    await removeCreatedUser(
      service,
      user.id,
      linkError?.message ?? "The account was provisioned concurrently."
    );
  }
  return reply({ ok: true, message: `Password set for ${profile.employee_id}.` });
}

async function createStaff(
  service: ReturnType<typeof getServiceClient>,
  body: RequestBody
) {
  const fullName = body.fullName?.trim();
  const employeeId = body.employeeId?.trim().toUpperCase();
  const designation = body.designation?.trim();
  if (!fullName || !employeeId || !designation) {
    return reply({ ok: false, message: "Name, Employee ID, and designation are required." });
  }
  if (fullName.length > 160 || employeeId.length > 64 || designation.length > 160) {
    return reply({ ok: false, message: "One or more account fields are too long." });
  }
  if (typeof body.password !== "string") {
    return reply({ ok: false, message: "Password is required." });
  }
  const passwordError = validatePassword(body.password);
  if (passwordError) return reply({ ok: false, message: passwordError });

  const { user, email } = await createAuthUser(service, employeeId, body.password);
  const { data: profile, error } = await service
    .from("profiles")
    .insert({
      employee_id: employeeId,
      full_name: fullName,
      role: "staff",
      designation,
      monthly_leave_entitlement: 0,
      bypass_geofence: false,
      fine_exempt: false,
      auth_user_id: user.id,
      auth_email: email,
    })
    .select("*")
    .single();
  if (error) {
    await removeCreatedUser(service, user.id, error.message);
  }
  return reply({ ok: true, message: "Staff account created.", profile });
}

async function removeStaff(
  service: ReturnType<typeof getServiceClient>,
  body: RequestBody
) {
  const employeeId = body.employeeId?.trim();
  if (!employeeId) return reply({ ok: false, message: "Employee ID is required." });

  const { data: profile, error } = await service
    .from("profiles")
    .select("employee_id, role, auth_user_id")
    .eq("employee_id", employeeId)
    .maybeSingle();
  if (error) return reply({ ok: false, message: error.message }, 500);
  if (!profile) return reply({ ok: false, message: "Employee profile was not found." });
  if (profile.role !== "staff") {
    return reply({ ok: false, message: "Only staff accounts can be removed here." });
  }

  if (profile.auth_user_id) {
    const { error: deleteAuthError } = await service.auth.admin.deleteUser(
      profile.auth_user_id
    );
    if (deleteAuthError) return reply({ ok: false, message: deleteAuthError.message }, 400);
  }
  const { error: deleteProfileError } = await service
    .from("profiles")
    .delete()
    .eq("employee_id", employeeId);
  if (deleteProfileError) {
    return reply({ ok: false, message: deleteProfileError.message }, 500);
  }
  return reply({ ok: true, message: "Staff account removed." });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return reply({ ok: false, message: "Method not allowed." }, 405);
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return reply({ ok: false, message: "Request body must be valid JSON." }, 400);
  }

  try {
    const service = getServiceClient();
    if (body.action === "setup-superadmin") {
      return await setupSuperAdmin(service, body);
    }

    await requireSuperAdmin(request, service);
    switch (body.action) {
      case "set-password":
        return await setAccountPassword(service, body);
      case "create-staff":
        return await createStaff(service, body);
      case "remove-staff":
        return await removeStaff(service, body);
      default:
        return reply({ ok: false, message: "Unknown account action." }, 400);
    }
  } catch (error) {
    console.error("manage-accounts failed", error);
    return reply(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Account service failed.",
      },
      500
    );
  }
});
