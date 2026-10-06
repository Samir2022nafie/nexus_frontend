"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  Compass,
  Search,
  Users,
  Lock,
  Globe,
  Plus,
  ArrowRight,
  Sparkles,
  Check,
  ExternalLink,
  Crown,
  Shield,
  Loader2,
  Tag,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

import { apiGet, apiPost, ApiMeta } from "@/lib/api-client";
import { SYSTEM_CATEGORIES, getCategoryById } from "@/lib/taxonomy";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CroppedImage } from "@/components/ui/cropped-image";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PublicCommunity {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  category_id?: string;
  categoryId?: string;
  category?: {
    id: string;
    name: string;
    label?: string;
  } | null;
  banner_url?: string | null;
  bannerUrl?: string | null;
  profile_picture_url?: string | null;
  profilePictureUrl?: string | null;
  is_private?: boolean;
  isPrivate?: boolean;
  member_count?: number;
  memberCount?: number;
  isMember?: boolean;
}

interface CommunitiesResponse {
  data: PublicCommunity[];
  meta?: ApiMeta;
}

interface ManagedCommunityItem {
  id: string;
  slug: string;
  role: "owner" | "admin" | "moderator";
}

export default function ExploreCommunitiesPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("ALL");
  const [page, setPage] = React.useState(1);

  // Debounce search input
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // 1. Fetch managed communities to know if current user is owner/admin/mod
  const { data: managedCommunities } = useQuery<ManagedCommunityItem[]>({
    queryKey: ["managedCommunities"],
    queryFn: () => apiGet<ManagedCommunityItem[]>("/users/me/communities"),
  });

  const managedMap = React.useMemo(() => {
    const map = new Map<string, "owner" | "admin" | "moderator">();
    if (managedCommunities) {
      for (const c of managedCommunities) {
        map.set(c.slug, c.role);
      }
    }
    return map;
  }, [managedCommunities]);

  // 2. Fetch public communities
  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "12");
    if (debouncedQuery) {
      params.set("q", debouncedQuery);
    }
    if (selectedCategory && selectedCategory !== "ALL") {
      params.set("categoryId", selectedCategory);
    }
    return params.toString();
  }, [page, debouncedQuery, selectedCategory]);

  const {
    data: communitiesData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<CommunitiesResponse | PublicCommunity[]>({
    queryKey: ["exploreCommunities", queryParams],
    queryFn: () => apiGet<CommunitiesResponse | PublicCommunity[]>(`/communities?${queryParams}`),
  });

  const communitiesList: PublicCommunity[] = React.useMemo(() => {
    if (!communitiesData) return [];
    if (Array.isArray(communitiesData)) return communitiesData;
    return communitiesData.data || [];
  }, [communitiesData]);

  // 3. Join Community Mutation
  const joinMutation = useMutation({
    mutationFn: (slug: string) => apiPost(`/communities/${slug}/join`),
    onSuccess: (_, slug) => {
      toast.success("Successfully joined community!");
      queryClient.invalidateQueries({ queryKey: ["exploreCommunities"] });
      queryClient.invalidateQueries({ queryKey: ["managedCommunities"] });
    },
    onError: (err) => {
      if (isAxiosError(err)) {
        const message =
          (err.response?.data as { error?: { message?: string } })?.error?.message;
        toast.error(message || err.message || "Failed to join community");
      } else {
        toast.error((err as Error).message || "Failed to join community");
      }
    },
  });

  // 4. Leave Community Mutation
  const leaveMutation = useMutation({
    mutationFn: (slug: string) => apiPost(`/communities/${slug}/leave`),
    onSuccess: () => {
      toast.success("Left community");
      queryClient.invalidateQueries({ queryKey: ["exploreCommunities"] });
      queryClient.invalidateQueries({ queryKey: ["managedCommunities"] });
    },
    onError: (err) => {
      if (isAxiosError(err)) {
        const message =
          (err.response?.data as { error?: { message?: string } })?.error?.message;
        toast.error(message || err.message || "Failed to leave community");
      } else {
        toast.error((err as Error).message || "Failed to leave community");
      }
    },
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Compass className="size-7 text-primary" />
            <span>Explore Communities</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Discover public communities across Nexus, connect with new groups, or join shared hobbies.
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search communities by name or keyword..."
            className="pl-9 text-xs h-9"
          />
        </div>

        <div className="w-full sm:w-64">
          <Select
            value={selectedCategory}
            onValueChange={(val) => {
              setSelectedCategory(val || "ALL");
              setPage(1);
            }}
          >
            <SelectTrigger className="text-xs h-9 w-full">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="ALL" className="text-xs">
                All Categories
              </SelectItem>
              {SYSTEM_CATEGORIES.map((cat) => (
                <SelectItem key={cat.id} value={cat.id} className="text-xs">
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Communities Grid */}
      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-5 space-y-4 border-border/70">
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="size-12 rounded-xl" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </Card>
          ))}
        </div>
      ) : isError ? (
        <Card className="p-12 text-center border-dashed border-border/80">
          <p className="text-sm text-destructive font-medium">Failed to load public communities.</p>
          <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-4">
            Try Again
          </Button>
        </Card>
      ) : communitiesList.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {communitiesList.map((comm) => {
            const pic = comm.profilePictureUrl || comm.profile_picture_url;
            const isPriv = comm.isPrivate ?? comm.is_private ?? false;
            const count = comm.memberCount ?? comm.member_count ?? 0;
            const catId = comm.categoryId || comm.category_id || comm.category?.id;
            const categoryObj = getCategoryById(catId) || comm.category;
            const categoryLabel = categoryObj?.label || categoryObj?.name || "General";
            const myRole = managedMap.get(comm.slug);
            const isManager = Boolean(myRole);

            return (
              <Card
                key={comm.id}
                className="group flex flex-col justify-between border-border/70 bg-card transition-all duration-200 hover:border-border hover:shadow-xl hover:shadow-foreground/5 hover:-translate-y-0.5 overflow-hidden"
              >
                {/* Clickable Card Upper Body navigating to Community Public Preview */}
                <Link
                  href={`/communities/${comm.slug}`}
                  className="block focus-visible:outline-none flex-1"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative size-12 rounded-xl overflow-hidden bg-primary/10 border border-border/80 flex items-center justify-center shrink-0 font-bold text-sm text-primary uppercase">
                          {pic ? (
                            <CroppedImage
                              src={pic}
                              alt={comm.name}
                              fill
                              containerClassName="size-full rounded-none"
                            />
                          ) : (
                            comm.name.slice(0, 2)
                          )}
                        </div>

                        <div className="min-w-0">
                          <CardTitle className="truncate text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                            {comm.name}
                          </CardTitle>
                          <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 mt-0.5 text-muted-foreground border-border/60">
                            {categoryLabel}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <CardDescription className="line-clamp-2 mt-3 text-xs leading-relaxed text-muted-foreground">
                      {comm.description || "No community description provided."}
                    </CardDescription>
                  </CardHeader>
                </Link>

                <CardContent className="pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/communities/${comm.slug}`}
                      className="flex items-center gap-3 text-xs text-muted-foreground font-medium hover:text-foreground transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <Users className="size-3.5" />
                        {count} {count === 1 ? "member" : "members"}
                      </span>

                      {isPriv ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Lock className="size-2.5" />
                          Private
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Globe className="size-2.5" />
                          Public
                        </span>
                      )}
                    </Link>

                    <div className="flex items-center gap-2">
                      {isManager ? (
                        <Button
                          render={<Link href={`/communities/${comm.slug}`} />}
                          size="sm"
                          className="h-8 gap-1.5 rounded-lg text-xs font-semibold bg-primary/15 dark:bg-amber-400/15 text-primary dark:text-amber-400 border border-primary/30 dark:border-amber-400/40 shadow-xs group-hover:bg-primary group-hover:text-neutral-950 dark:group-hover:bg-amber-400 dark:group-hover:text-neutral-950 group-hover:border-primary group-hover:shadow-md transition-all cursor-pointer"
                        >
                          {myRole === "owner" ? (
                            <Crown className="size-3 text-amber-500 shrink-0" />
                          ) : (
                            <Shield className="size-3 text-sky-500 shrink-0" />
                          )}
                          <span>Manage</span>
                        </Button>
                      ) : comm.isMember ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            leaveMutation.mutate(comm.slug);
                          }}
                          disabled={leaveMutation.isPending}
                          className="h-8 text-xs gap-1 cursor-pointer"
                        >
                          <Check className="size-3 text-emerald-500" />
                          <span>Joined</span>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            joinMutation.mutate(comm.slug);
                          }}
                          disabled={joinMutation.isPending}
                          className="h-8 text-xs gap-1.5 cursor-pointer shadow-xs"
                        >
                          {joinMutation.isPending ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Plus className="size-3.5" />
                          )}
                          <span>Join</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-border/80 bg-card/50">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4 ring-8 ring-primary/5">
            <Compass className="size-7" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No communities found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
            {searchQuery || selectedCategory !== "ALL"
              ? "Try adjusting your search query or selecting a different category filter."
              : "No public communities are available right now."}
          </p>
          {(searchQuery || selectedCategory !== "ALL") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("ALL");
              }}
              className="text-xs"
            >
              Clear Filters
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}
