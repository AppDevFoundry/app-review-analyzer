"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { cn } from "@/lib/utils";
import { userAuthSchema } from "@/lib/validations/auth";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Icons } from "@/components/shared/icons";

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: string;
}

type FormData = z.infer<typeof userAuthSchema>;

export function UserAuthForm({ className, type, ...props }: UserAuthFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(userAuthSchema),
  });
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [isGoogleLoading, setIsGoogleLoading] = React.useState<boolean>(false);
  const [isDevLoginLoading, setIsDevLoginLoading] = React.useState<boolean>(false);
  const searchParams = useSearchParams();
  const isDevelopment = process.env.NODE_ENV === "development";

  async function onSubmit(data: FormData) {
    setIsLoading(true);

    const signInResult = await signIn("resend", {
      email: data.email.toLowerCase(),
      redirect: false,
      callbackUrl: searchParams?.get("from") || "/dashboard",
    });

    setIsLoading(false);

    if (!signInResult?.ok) {
      return toast.error("Something went wrong.", {
        description: "Your sign in request failed. Please try again."
      });
    }

    return toast.success("Check your email", {
      description: "We sent you a login link. Be sure to check your spam too.",
    });
  }

  async function handleDevLogin(email: string) {
    setIsDevLoginLoading(true);

    const signInResult = await signIn("dev-login", {
      email,
      redirect: false,
      callbackUrl: searchParams?.get("from") || "/dashboard",
    });

    setIsDevLoginLoading(false);

    if (!signInResult?.ok) {
      return toast.error("Dev login failed", {
        description: signInResult?.error || "User not found in database",
      });
    }

    // Redirect on success
    window.location.href = searchParams?.get("from") || "/dashboard";
  }

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      {isDevelopment && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icons.warning className="size-4 text-yellow-600" />
            <p className="text-sm font-medium text-yellow-800">
              Development Mode
            </p>
          </div>
          <p className="text-xs text-yellow-700 mb-3">
            Quick login for testing (disabled in production)
          </p>
          <button
            type="button"
            onClick={() => handleDevLogin("demo@appanalyzer.dev")}
            disabled={isDevLoginLoading}
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "w-full"
            )}
          >
            {isDevLoginLoading && (
              <Icons.spinner className="mr-2 size-4 animate-spin" />
            )}
            Login as Demo User
          </button>
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-2">
          <div className="grid gap-1">
            <Label className="sr-only" htmlFor="email">
              Email
            </Label>
            <Input
              id="email"
              placeholder="name@example.com"
              type="email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              disabled={isLoading || isGoogleLoading || isDevLoginLoading}
              {...register("email")}
            />
            {errors?.email && (
              <p className="px-1 text-xs text-red-600">
                {errors.email.message}
              </p>
            )}
          </div>
          <button className={cn(buttonVariants())} disabled={isLoading || isDevLoginLoading}>
            {isLoading && (
              <Icons.spinner className="mr-2 size-4 animate-spin" />
            )}
            {type === "register" ? "Sign Up with Email" : "Sign In with Email"}
          </button>
        </div>
      </form>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>
      <button
        type="button"
        className={cn(buttonVariants({ variant: "outline" }))}
        onClick={() => {
          setIsGoogleLoading(true);
          signIn("google");
        }}
        disabled={isLoading || isGoogleLoading || isDevLoginLoading}
      >
        {isGoogleLoading ? (
          <Icons.spinner className="mr-2 size-4 animate-spin" />
        ) : (
          <Icons.google className="mr-2 size-4" />
        )}{" "}
        Google
      </button>
    </div>
  );
}
