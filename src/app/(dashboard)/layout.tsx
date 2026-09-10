"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Calendar,
  ShieldAlert,
  Settings,
  Building2,
  Compass,
  Globe,
  Bell,
} from "lucide-react";
import { toast } from "sonner";

import { apiGet } from "@/lib/api-client";
import {
  NotificationsDropdown,
  NotificationsResponse,
} from "@/components/notifications-dropdown";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

interface ManagedCommunity {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  bannerUrl?: string | null;
  profilePictureUrl?: string | null;
  isPrivate?: boolean;
  memberCount?: number;
  role: "owner" | "admin" | "moderator";
}

interface UserProfile {
  id: string;
  username: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  profile_picture_url?: string | null;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  const isClient = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const [authToken, setAuthToken] = React.useState<string | null>(null);

  // Check auth token existence and handle mobile gateway switch deep-link (?token=...)
  React.useEffect(() => {
    if (isClient) {
      const searchParams = new URLSearchParams(window.location.search);
      const queryToken =
        searchParams.get("token") || searchParams.get("bearer_token");
      if (queryToken) {
        localStorage.setItem("bearer_token", queryToken);
        setAuthToken(queryToken);
        searchParams.delete("token");
        searchParams.delete("bearer_token");
        const remainingQuery = searchParams.toString();
        const cleanUrl =
          window.location.pathname +
          (remainingQuery ? `?${remainingQuery}` : "") +
          window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
        queryClient.invalidateQueries();
      } else {
        const stored = localStorage.getItem("bearer_token");
        setAuthToken(stored);
        if (!stored) {
          router.replace("/login");
        }
      }
    }
  }, [isClient, router, queryClient]);

  const tokenChecked = Boolean(isClient && authToken);

  // Fetch current user
  const { data: user, isLoading: isLoadingUser } = useQuery<UserProfile>({
    queryKey: ["currentUser"],
    queryFn: () => apiGet<UserProfile>("/users/me"),
    enabled: tokenChecked,
  });

  // Fetch managed communities for sidebar
  const { data: communities, isLoading: isLoadingCommunities } = useQuery<
    ManagedCommunity[]
  >({
    queryKey: ["managedCommunities"],
    queryFn: () => apiGet<ManagedCommunity[]>("/users/me/communities"),
    enabled: tokenChecked,
  });

  // Fetch unread notifications for sidebar badge (shares query cache with header dropdown)
  const { data: unreadNotificationsData } = useQuery<NotificationsResponse>({
    queryKey: ["notifications", "header"],
    queryFn: () =>
      apiGet<NotificationsResponse>(
        "/notifications?unreadOnly=true&limit=5&sort=created_at&order=desc"
      ),
    enabled: tokenChecked,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const totalUnreadNotifications = React.useMemo(() => {
    if (
      unreadNotificationsData &&
      !Array.isArray(unreadNotificationsData) &&
      typeof unreadNotificationsData.meta?.total === "number"
    ) {
      return unreadNotificationsData.meta.total;
    }
    if (Array.isArray(unreadNotificationsData)) {
      return unreadNotificationsData.filter((n) => !(n.isRead || n.is_read)).length;
    }
    return (
      unreadNotificationsData?.data?.filter((n) => !(n.isRead || n.is_read))
        .length || 0
    );
  }, [unreadNotificationsData]);

  // Extract community context slug if path is /communities/[slug]/*
  const communityMatch = pathname.match(/^\/communities\/([^/]+)/);
  const currentSlug = communityMatch ? communityMatch[1] : null;
  const currentCommunity = React.useMemo(() => {
    if (!currentSlug || !communities) return null;
    return communities.find((c) => c.slug === currentSlug) || null;
  }, [currentSlug, communities]);

  // Fetch community metadata for non-managed communities to display the human name in breadcrumbs
  const { data: publicCommMeta } = useQuery<{ name: string; slug: string }>({
    queryKey: ["communityBreadcrumbMeta", currentSlug],
    queryFn: () =>
      apiGet<{ name: string; slug: string }>(`/communities/${currentSlug}`),
    enabled: Boolean(tokenChecked && currentSlug && !currentCommunity),
    staleTime: 5 * 60 * 1000,
  });

  const communityDisplayName =
    currentCommunity?.name || publicCommMeta?.name || currentSlug || "Community";

  // User initials for avatar fallback
  const userInitials = React.useMemo(() => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    if (user?.name) {
      const parts = user.name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (user?.username) {
      return user.username.slice(0, 2).toUpperCase();
    }
    return "U";
  }, [user]);

  // Compute Breadcrumb trail
  const breadcrumbs = React.useMemo(() => {
    if (pathname === "/") {
      return [{ label: "Dashboard", href: "/", isCurrent: true }];
    }

    if (pathname === "/explore") {
      return [{ label: "Explore", href: "/explore", isCurrent: true }];
    }

    if (pathname.startsWith("/notifications")) {
      return [{ label: "Notifications", href: "/notifications", isCurrent: true }];
    }

    if (pathname.startsWith("/profile")) {
      return [{ label: "My Profile", href: "/profile", isCurrent: true }];
    }

    if (pathname.startsWith("/users/")) {
      return [
        { label: "Explore", href: "/explore" },
        { label: "User Profile", isCurrent: true },
      ];
    }

    if (currentSlug) {
      // If user is a manager of this community: root is Dashboard
      // If user does NOT manage this community (e.g. visiting public preview): root is Explore
      const isManagerOfThis = Boolean(currentCommunity);
      const rootCrumb = isManagerOfThis
        ? { label: "Dashboard", href: "/" }
        : { label: "Explore", href: "/explore" };

      const crumbs: Array<{ label: string; href?: string; isCurrent?: boolean }> = [
        rootCrumb,
      ];

      const subpath = pathname.replace(`/communities/${currentSlug}`, "");

      if (!subpath || subpath === "") {
        crumbs.push({ label: communityDisplayName, isCurrent: true });
      } else {
        crumbs.push({
          label: communityDisplayName,
          href: `/communities/${currentSlug}`,
        });

        if (subpath.startsWith("/members")) {
          crumbs.push({ label: "Members", isCurrent: true });
        } else if (subpath.startsWith("/posts")) {
          crumbs.push({ label: "Posts", isCurrent: true });
        } else if (subpath.startsWith("/events")) {
          crumbs.push({ label: "Events", isCurrent: true });
        } else if (subpath.startsWith("/reports")) {
          crumbs.push({ label: "Reports", isCurrent: true });
        } else if (subpath.startsWith("/settings")) {
          crumbs.push({ label: "Settings", isCurrent: true });
        } else {
          const section = subpath.replace(/^\//, "");
          crumbs.push({
            label: section.charAt(0).toUpperCase() + section.slice(1),
            isCurrent: true,
          });
        }
      }

      return crumbs;
    }

    return [{ label: "Dashboard", href: "/", isCurrent: true }];
  }, [pathname, currentSlug, currentCommunity, communityDisplayName]);

  if (!tokenChecked) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/20">
        <Sidebar collapsible="icon" className="border-r border-border">
          {/* Sidebar Header */}
          <SidebarHeader className="border-b border-border px-4 py-3">
            <Link
              href="/"
              className="flex items-center gap-2.5 font-semibold transition-opacity hover:opacity-85"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Compass className="size-4" />
              </div>
              <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-semibold tracking-tight text-foreground">
                  HobbyHub
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  Admin Dashboard
                </span>
              </div>
            </Link>
          </SidebarHeader>

          {/* Sidebar Content */}
          <SidebarContent>
            {/* Nav Group 1: Dashboard */}
            <SidebarGroup>
              <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={<Link href="/" />}
                      isActive={pathname === "/"}
                      tooltip="Dashboard Home"
                    >
                      <LayoutDashboard className="size-4" />
                      <span>Dashboard Home</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={<Link href="/explore" />}
                      isActive={pathname.startsWith("/explore")}
                      tooltip="Explore Communities"
                    >
                      <Globe className="size-4" />
                      <span>Explore Communities</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={<Link href="/notifications" />}
                      isActive={pathname.startsWith("/notifications")}
                      tooltip="Notifications"
                    >
                      <Bell className="size-4" />
                      <span className="flex-1">Notifications</span>
                      {totalUnreadNotifications > 0 && (
                        <Badge
                          variant="secondary"
                          className="ml-auto text-[10px] px-1.5 py-0 font-mono shrink-0"
                        >
                          {totalUnreadNotifications > 99
                            ? "99+"
                            : totalUnreadNotifications}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Nav Group 2: My Communities (Dynamic) */}
            <SidebarGroup>
              <SidebarGroupLabel>My Communities</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {isLoadingCommunities ? (
                    <>
                      <SidebarMenuItem>
                        <SidebarMenuSkeleton showIcon />
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuSkeleton showIcon />
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuSkeleton showIcon />
                      </SidebarMenuItem>
                    </>
                  ) : communities && communities.length > 0 ? (
                    communities.map((community) => {
                      const isActive = currentSlug === community.slug;
                      return (
                        <SidebarMenuItem key={community.id}>
                          <SidebarMenuButton
                            render={
                              <Link href={`/communities/${community.slug}`} />
                            }
                            isActive={isActive}
                            tooltip={community.name}
                            className="justify-between"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Building2 className="size-4 shrink-0 text-muted-foreground" />
                              <span className="truncate">{community.name}</span>
                            </div>
                            <Badge
                              variant="secondary"
                              className="text-[10px] uppercase font-mono px-1.5 py-0 group-data-[collapsible=icon]:hidden"
                            >
                              {community.role}
                            </Badge>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })
                  ) : (
                    <div className="px-3 py-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                      No managed communities yet.
                    </div>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Nav Group 3: Community Management (Contextual - Only for Managers) */}
            {currentCommunity && (
              <SidebarGroup>
                <SidebarGroupLabel>
                  <span className="truncate">
                    {currentCommunity.name}
                  </span>
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        render={
                          <Link href={`/communities/${currentSlug}`} />
                        }
                        isActive={pathname === `/communities/${currentSlug}`}
                        tooltip="Overview"
                      >
                        <LayoutDashboard className="size-4" />
                        <span>Overview</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    <SidebarMenuItem>
                      <SidebarMenuButton
                        render={
                          <Link href={`/communities/${currentSlug}/members`} />
                        }
                        isActive={pathname.startsWith(
                          `/communities/${currentSlug}/members`
                        )}
                        tooltip="Members"
                      >
                        <Users className="size-4" />
                        <span>Members</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    <SidebarMenuItem>
                      <SidebarMenuButton
                        render={
                          <Link href={`/communities/${currentSlug}/posts`} />
                        }
                        isActive={pathname.startsWith(
                          `/communities/${currentSlug}/posts`
                        )}
                        tooltip="Posts"
                      >
                        <MessageSquare className="size-4" />
                        <span>Posts</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    <SidebarMenuItem>
                      <SidebarMenuButton
                        render={
                          <Link href={`/communities/${currentSlug}/events`} />
                        }
                        isActive={pathname.startsWith(
                          `/communities/${currentSlug}/events`
                        )}
                        tooltip="Events"
                      >
                        <Calendar className="size-4" />
                        <span>Events</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    <SidebarMenuItem>
                      <SidebarMenuButton
                        render={
                          <Link href={`/communities/${currentSlug}/reports`} />
                        }
                        isActive={pathname.startsWith(
                          `/communities/${currentSlug}/reports`
                        )}
                        tooltip="Reports"
                      >
                        <ShieldAlert className="size-4" />
                        <span>Reports</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    <SidebarMenuItem>
                      <SidebarMenuButton
                        render={
                          <Link href={`/communities/${currentSlug}/settings`} />
                        }
                        isActive={pathname.startsWith(
                          `/communities/${currentSlug}/settings`
                        )}
                        tooltip="Settings"
                      >
                        <Settings className="size-4" />
                        <span>Settings</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarRail />
        </Sidebar>

        {/* Main Inset Area */}
        <SidebarInset className="flex min-h-screen flex-1 flex-col bg-background">
          {/* Top Header */}
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-md">
            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
              <SidebarTrigger className="-ml-1 shrink-0" />
              <Separator orientation="vertical" className="mr-2 h-4 shrink-0" />

              <Breadcrumb className="overflow-hidden flex">
                <BreadcrumbList className="flex-nowrap">
                  {breadcrumbs.map((crumb, index) => {
                    const isLast = index === breadcrumbs.length - 1;
                    return (
                      <React.Fragment key={crumb.label + index}>
                        {index > 0 && (
                          <BreadcrumbSeparator
                            className={`shrink-0 ${
                              !isLast && index > 0 && breadcrumbs.length > 2
                                ? "hidden sm:inline-flex"
                                : ""
                            }`}
                          />
                        )}
                        <BreadcrumbItem
                          className={`truncate ${
                            !isLast && index > 0 && breadcrumbs.length > 2
                              ? "hidden sm:inline-flex"
                              : ""
                          }`}
                        >
                          {crumb.isCurrent || !crumb.href ? (
                            <BreadcrumbPage className="truncate max-w-[130px] sm:max-w-[200px] md:max-w-none">
                              {crumb.label}
                            </BreadcrumbPage>
                          ) : (
                            <BreadcrumbLink
                              render={<Link href={crumb.href} />}
                              className="truncate max-w-[100px] sm:max-w-[150px] md:max-w-none"
                            >
                              {crumb.label}
                            </BreadcrumbLink>
                          )}
                        </BreadcrumbItem>
                      </React.Fragment>
                    );
                  })}
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Notifications Dropdown */}
              <NotificationsDropdown />

              <Separator orientation="vertical" className="h-4" />

              {isLoadingUser ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <Link
                  href="/profile"
                  className="flex items-center gap-2 rounded-full py-1 px-2.5 outline-none hover:bg-muted/80 transition-colors cursor-pointer border border-border/40 hover:border-border"
                  title="My Profile"
                >
                  <span className="hidden text-xs font-medium text-foreground sm:inline-block max-w-[140px] truncate">
                    {user?.name || user?.username}
                  </span>
                  <Avatar size="sm">
                    {user?.profile_picture_url && (
                      <AvatarImage
                        src={user.profile_picture_url}
                        alt={user.name || user.username}
                      />
                    )}
                    <AvatarFallback>{userInitials}</AvatarFallback>
                  </Avatar>
                </Link>
              )}
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
