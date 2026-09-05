import * as z from "zod";

export const SignupFormSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, { error: "Name must be at least 2 characters long." }),
    email: z.email({ error: "Please enter a valid email." }).trim(),
    password: z
      .string()
      .min(8, { error: "Be at least 8 characters long." })
      .regex(/[a-zA-Z]/, { error: "Contain at least one letter." })
      .regex(/[0-9]/, { error: "Contain at least one number." }),
    confirmPassword: z.string(),
    requestedRoles: z
      .array(z.enum(["tutor", "tutee"]))
      .min(1, { error: "Select at least one role you're signing up for." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type SignupFormState =
  | {
      errors?: {
        fullName?: string[];
        email?: string[];
        password?: string[];
        confirmPassword?: string[];
        requestedRoles?: string[];
      };
      message?: string;
    }
  | undefined;

// Sessions are always 12:15–12:45 PM Central, so the only time input is the
// date. The date itself is validated server-side (school day, teacher hosting,
// not in the past) — those need the database, so there's no point duplicating
// a weaker version of them here.
export const CreateSlotFormSchema = z
  .object({
    sessionDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Choose a date." }),
    courseId: z.uuid({ error: "Choose a course." }),
    capacityMode: z.enum(["limited", "unlimited"], {
      error: "Choose how many people can join.",
    }),
    capacity: z.coerce
      .number()
      .int()
      .min(1, { error: "Must be at least 1." })
      .max(100, { error: "Keep it to 100 or fewer." }),
    helpMode: z.enum(["individual", "group"], {
      error: "Choose individual or group help.",
    }),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
  })
  // Capacity only has to be sensible when it's actually being used.
  .refine(
    (data) => data.capacityMode === "unlimited" || data.capacity >= 1,
    { error: "Enter a number between 1 and 100.", path: ["capacity"] }
  );

export type CreateSlotFormState =
  | {
      errors?: {
        sessionDate?: string[];
        courseId?: string[];
        capacityMode?: string[];
        capacity?: string[];
        helpMode?: string[];
        notes?: string[];
      };
      message?: string;
    }
  | undefined;

export const GuestBookingFormSchema = z.object({
  slotId: z.uuid({ error: "That slot link looks invalid." }),
  name: z
    .string()
    .trim()
    .min(2, { error: "Name must be at least 2 characters long." })
    .max(200, { error: "Keep it under 200 characters." }),
  email: z.email({ error: "Please enter a valid email." }).trim(),
});

export type GuestBookingFormState =
  | {
      errors?: {
        name?: string[];
        email?: string[];
      };
      message?: string;
    }
  | undefined;

export const LoginFormSchema = z.object({
  email: z.email({ error: "Please enter a valid email." }).trim(),
  password: z.string().min(1, { error: "Password is required." }),
});

export type LoginFormState =
  | {
      errors?: {
        email?: string[];
        password?: string[];
      };
      message?: string;
    }
  | undefined;
