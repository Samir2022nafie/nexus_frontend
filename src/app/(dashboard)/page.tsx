"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Building2, Compass, ArrowRight } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface ManagedCommunity {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  memberCount?: number;
  role: "owner" | "admin" | "moderator";
}

export default function DashboardHomePage() {
  const { data: communities, isLoading } = useQuery<ManagedCommunity[]>({
    queryKey: ["managedCommunities"],
    queryFn: () => apiGet<ManagedCommunity[]>("/users/me/communities"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome to HobbyHub Admin
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your communities, members, events, posts, and moderation from one central dashboard.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">My Communities</h2>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-8 w-28" />
              </Card>
            ))}
          </div>
        ) : communities && communities.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {communities.map((community) => (
              <Card key={community.id} className="flex flex-col justify-between transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="truncate">{community.name}</CardTitle>
                    <Badge variant="secondary" className="uppercase text-[10px] font-mono">
                      {community.role}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {community.description || "No description provided."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {community.memberCount ?? 0} members
                    </span>
                    <Button render={<Link href={`/communities/${community.slug}`} />} size="sm" variant="outline">
                      Manage <ArrowRight className="ml-1 size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="flex flex-col items-center justify-center p-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
              <Building2 className="size-6" />
            </div>
            <h3 className="font-semibold text-foreground">No managed communities yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
              You don&apos;t manage any communities yet. Once you create or get promoted in a community, it will appear here.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
