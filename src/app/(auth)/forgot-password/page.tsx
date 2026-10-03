"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { isAxiosError } from "axios";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
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

const forgotPasswordSchema = z.object({
  identifier: z
    .string()
    .min(1, "Email or phone number is required")
    .trim(),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      identifier: "",
    },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setIsLoading(true);
    try {
      await apiPost("/auth/forgot-password", {
        identifier: values.identifier.trim(),
      });
      setIsSubmitted(true);
      toast.success("If an account exists, a reset link has been sent.");
    } catch (error) {
      if (isAxiosError(error)) {
        const errorMsg =
          error.response?.data?.error?.message ||
          error.response?.data?.message;
        if (errorMsg) {
          toast.error(errorMsg);
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

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-4 sm:p-8">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
        <div className="h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <Card className="w-full max-w-md border-border/70 bg-card/95 shadow-2xl shadow-foreground/5 backdrop-blur-sm sm:rounded-2xl">
        <CardHeader className="space-y-3 pb-6 text-center">
          <div className="mx-auto size-16 overflow-hidden rounded-2xl shadow-lg ring-4 ring-primary/10">
            <NexusLogo className="size-full" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              {isSubmitted ? "Check Your Inbox" : "Forgot Password"}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {isSubmitted
                ? "If an account with that identifier exists, we've sent a password reset link."
                : "Enter your email or phone number and we'll send you a reset link."}
            </CardDescription>
          </div>
        </CardHeader>

        {isSubmitted ? (
          <CardFooter className="flex flex-col gap-3.5 pt-2 pb-6">
            <Button
              type="button"
              className="h-10 w-full rounded-lg font-medium shadow-md shadow-primary/15 transition-all hover:shadow-lg hover:shadow-primary/25 cursor-pointer"
              onClick={() => setIsSubmitted(false)}
            >
              Try Again
            </Button>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline underline-offset-4"
            >
              <ArrowLeft className="size-3" />
              Back to Sign In
            </Link>
          </CardFooter>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="identifier" className="text-sm font-medium text-foreground">
                  Email or Phone Number
                </Label>
                <div className="relative">
                  <Input
                    id="identifier"
                    type="text"
                    autoComplete="username"
                    disabled={isLoading}
                    className="h-10 pr-10 rounded-lg border-border/80 focus-visible:ring-2 focus-visible:ring-primary/30"
                    {...register("identifier")}
                  />
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                </div>
                {errors.identifier && (
                  <p className="text-xs font-medium text-destructive">
                    {errors.identifier.message}
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
                    Sending...
                  </>
                ) : (
                  "Send Reset Link"
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
