"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log in</CardTitle>
        <CardDescription>Welcome back.</CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
            {state?.errors?.email && (
              <p className="text-sm text-destructive">
                {state.errors.email[0]}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
            {state?.errors?.password && (
              <p className="text-sm text-destructive">
                {state.errors.password[0]}
              </p>
            )}
          </div>

          {state?.message && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}
        </CardContent>
        <CardFooter className="mt-2 flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Logging in..." : "Log in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Need an account?{" "}
            <Link href="/signup" className="font-medium text-foreground underline">
              Sign up
            </Link>
          </p>
          <p className="text-center text-sm text-muted-foreground">
            Just booking one session?{" "}
            <Link href="/calendar" className="font-medium text-foreground underline">
              Book without an account
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
