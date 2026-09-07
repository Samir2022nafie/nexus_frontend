"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { isAxiosError } from "axios";
import { Compass, Loader2, Lock, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { apiPost } from "@/lib/api-client";
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

const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, "Email or phone number is required")
    .trim(),
  password: z
    .string()
    .min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginResponseData {
  user: {
    id: string;
    username: string;
    email?: string | null;
    phone_number?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    name?: string | null;
    trust_score?: number;
  };
  token: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  // If already authenticated, redirect to /
  React.useEffect(() => {
    const token = localStorage.getItem("bearer_token");
    if (token) {
      router.replace("/");
    }
  }, [router]);

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    try {
      const response = await apiPost<LoginResponseData>("/auth/login", {
        identifier: values.identifier,
        password: values.password,
      });

      if (response && response.token) {
        localStorage.setItem("bearer_token", response.token);
        if (response.user) {
          localStorage.setItem("auth_user", JSON.stringify(response.user));
        }
        toast.success("Signed in successfully!");
        router.push("/");
      } else {
        toast.error("Failed to authenticate with server");
      }
    } catch (error) {
      if (isAxiosError(error)) {
        if (error.response?.status === 401) {
          toast.error("Invalid credentials");
        } else if (error.response?.data?.error?.message) {
          toast.error(error.response.data.error.message);
        } else {
          toast.error("Sign in failed. Please check your connection.");
        }
      } else {
        toast.error("An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4 sm:p-8">
      <Card className="w-full max-w-md shadow-lg border-border/80">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <Compass className="size-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            HobbyHub Admin
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Sign in to access your community management dashboard.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {/* Identifier Field (Email or Phone) */}
            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-sm font-medium">
                Email or Phone Number
              </Label>
              <div className="relative">
                <Input
                  id="identifier"
                  type="text"
                  placeholder="name@example.com or +2519..."
                  autoComplete="username"
                  disabled={isLoading}
                  className="pr-10"
                  {...register("identifier")}
                />
                <UserCheck className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              </div>
              {errors.identifier && (
                <p className="text-xs font-medium text-destructive">
                  {errors.identifier.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={isLoading}
                  className="pr-10"
                  {...register("password")}
                />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              </div>
              {errors.password && (
                <p className="text-xs font-medium text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              className="w-full font-medium"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Authorized community owners, admins, and moderators only.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
