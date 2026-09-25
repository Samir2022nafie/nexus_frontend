"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { isAxiosError } from "axios";
import { Loader2, Lock, ArrowLeft, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { apiPost } from "@/lib/api-client";
import { NexusLogo } from "@/components/ui/nexus-logo";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password is too long"),
    confirmPassword: z
      .string()
      .min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [token, setToken] = React.useState<string>("");
  const [isReady, setIsReady] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  React.useEffect(() => {
    let t = searchParams.get("token")?.trim() || "";
    if (!t && typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      t = urlParams.get("token")?.trim() || "";
    }
    setToken(t);
    setIsReady(true);
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: ResetPasswordFormValues) => {
    if (!token) {
      toast.error("Missing reset token. Please use the link from your email/SMS.");
      return;
    }

    setIsLoading(true);
    try {
      await apiPost("/auth/reset-password", {
        token: token.trim(),
        newPassword: values.newPassword,
      });
      setIsSuccess(true);
      toast.success("Password reset successfully!");
    } catch (error) {
      if (isAxiosError(error)) {
        const errorMsg =
          error.response?.data?.error?.message ||
          error.response?.data?.message;
        if (errorMsg) {
          toast.error(errorMsg);
        } else if (error.response?.status === 400) {
          toast.error("Invalid or expired reset link. Please request a new one.");
        } else {
          toast.error(error.message || "Something went wrong. Please try again.");
        }
      } else {
        toast.error("An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isReady) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  // No token in URL
  if (!token && !isSuccess) {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-4 sm:p-8">
        <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
          <div className="h-[500px] w-[500px] rounded-full bg-destructive/5 blur-[120px]" />
        </div>
        <Card className="w-full max-w-md border-border/70 bg-card/95 shadow-2xl shadow-foreground/5 backdrop-blur-sm sm:rounded-2xl">
          <CardHeader className="space-y-3 pb-6 text-center">
            <CardTitle className="text-xl font-bold tracking-tight text-foreground">
              Invalid Reset Link
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              This password reset link is invalid or has expired. Please request a new one.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-3.5 pt-2 pb-6">
            <Link href="/forgot-password">
              <Button className="h-10 w-full rounded-lg font-medium cursor-pointer">
                Request New Link
              </Button>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline underline-offset-4"
            >
              <ArrowLeft className="size-3" />
              Back to Sign In
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-4 sm:p-8">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
        <div className="h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <Card className="w-full max-w-md border-border/70 bg-card/95 shadow-2xl shadow-foreground/5 backdrop-blur-sm sm:rounded-2xl">
        <CardHeader className="space-y-3 pb-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 ring-4 ring-primary/10 p-2.5">
            {isSuccess ? (
              <CheckCircle2 className="size-7" />
            ) : (
              <NexusLogo className="w-full h-full" />
            )}
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              {isSuccess ? "Password Updated" : "Set New Password"}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {isSuccess
                ? "Your password has been reset successfully. You can now sign in with your new password."
                : "Choose a strong password that you haven't used before."}
            </CardDescription>
          </div>
        </CardHeader>

        {isSuccess ? (
          <CardFooter className="flex flex-col gap-3.5 pt-2 pb-6">
            <Button
              type="button"
              className="h-10 w-full rounded-lg font-medium shadow-md shadow-primary/15 transition-all hover:shadow-lg hover:shadow-primary/25 cursor-pointer"
              onClick={() => router.push("/login")}
            >
              Go to Sign In
            </Button>
          </CardFooter>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              {/* New Password */}
              <div className="space-y-1.5">
                <Label htmlFor="newPassword" className="text-sm font-medium text-foreground">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    autoComplete="new-password"
                    disabled={isLoading}
                    className="h-10 pr-10 rounded-lg border-border/80 focus-visible:ring-2 focus-visible:ring-primary/30"
                    {...register("newPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                  >
                    {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors.newPassword && (
                  <p className="text-xs font-medium text-destructive">
                    {errors.newPassword.message}
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    disabled={isLoading}
                    className="h-10 pr-10 rounded-lg border-border/80 focus-visible:ring-2 focus-visible:ring-primary/30"
                    {...register("confirmPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs font-medium text-destructive">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3.5 pt-4">
              <Button
                type="submit"
                className="h-10 w-full rounded-lg font-medium shadow-md shadow-primary/15 transition-all hover:shadow-lg hover:shadow-primary/25 cursor-pointer"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline underline-offset-4"
              >
                <ArrowLeft className="size-3" />
                Back to Sign In
              </Link>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-background">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      }
    >
      <ResetPasswordContent />
    </React.Suspense>
  );
}
