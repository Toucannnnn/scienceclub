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

export const CreateSlotFormSchema = z
  .object({
    subjectId: z.string().trim().min(1).optional().or(z.literal("")),
    locationId: z.string().trim().min(1, { error: "Choose a location." }),
    startsAt: z.string().min(1, { error: "Choose a start time." }),
    endsAt: z.string().min(1, { error: "Choose an end time." }),
    maxCapacity: z.coerce
      .number()
      .int()
      .min(1, { error: "Must be at least 1." })
      .max(20, { error: "Keep it to 20 or fewer." }),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine((data) => new Date(data.endsAt) > new Date(data.startsAt), {
    error: "End time must be after the start time.",
    path: ["endsAt"],
  })
  .refine((data) => new Date(data.startsAt) > new Date(), {
    error: "Start time must be in the future.",
    path: ["startsAt"],
  });

export type CreateSlotFormState =
  | {
      errors?: {
        subjectId?: string[];
        locationId?: string[];
        startsAt?: string[];
        endsAt?: string[];
        maxCapacity?: string[];
        notes?: string[];
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
