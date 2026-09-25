"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, RefreshCw, Building2, Plus, ArrowLeft } from "lucide-react";

import { apiGet } from "@/lib/api-client";
import { ManagedCommunity } from "@/app/(dashboard)/page";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";

export default function GlobalPostsRedirectPage() {
  const router = useRouter();

  const { data: communities, isLoading } = useQuery<ManagedCommunity[]>({
    queryKey: ["managedCommunities"],
    queryFn: () => apiGet<ManagedCommunity[]>("/users/me/communities"),
  });

  React.useEffect(() => {
    if (communities && communities.length > 0) {
      router.replace(`/communities/${communities[0].slug}/posts`);
    }
  }, [communities, router]);

  if (isLoading || (communities && communities.length > 0)) {
    return (
      <div className="min-h-[50vh] w-full flex flex-col items-center justify-center gap-3">
        <RefreshCw className="size-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Redirecting to community posts...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 max-w-md mx-auto w-full text-center">
      <Card className="w-full border-border bg-card shadow-md">
        <CardHeader className="flex flex-col items-center gap-3 pt-8 pb-4">
          <div className="size-16 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <MessageSquare className="size-8" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            No Community Posts Yet
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Posts are published inside communities. You are not managing any communities yet.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center gap-3 pb-6">
          <Button render={<Link href="/" />} variant="outline" className="gap-2">
            <ArrowLeft className="size-4" />
            Dashboard
          </Button>
          <Button render={<Link href="/explore" />} className="gap-2">
            <Building2 className="size-4" />
            Explore Communities
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
