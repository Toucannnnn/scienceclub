"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  LoginFormSchema,
  type LoginFormState,
  SignupFormSchema,
  type SignupFormState,
} from "@/lib/definitions";

export async function signup(
  _state: SignupFormState,
  formData: FormData
): Promise<SignupFormState> {
  const validatedFields = SignupFormSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    requestedRoles: formData.getAll("requestedRoles"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { fullName, email, password, requestedRoles } = validatedFields.data;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, requested_roles: requestedRoles },
    },
  });

  if (error) {
    return { message: error.message };
  }

  // If email confirmation is required, signUp() returns no session and the
  // user needs to click the link we emailed them before they can log in.
  // If confirmation is disabled (or already auto-confirmed), we get a real
  // session back immediately — send them straight on instead of to a dead
  // end telling them to check an email that already did its job.
  if (!data.session) {
    redirect("/check-email");
  }

  redirect("/pending-approval");
}

export async function login(
  _state: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const validatedFields = LoginFormSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { email, password } = validatedFields.data;
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { message: "Invalid email or password." };
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
