// utils/follow.ts
// Following/followers. Everything goes through /api/follow, which writes both
// sides of a follow so the lists always match.

import { apiPost } from "./api";

export type FollowUser = {
  uid: string;
  displayName: string;
  isFollowing: boolean;
  isMe?: boolean;
};

export type UserSearchResult = FollowUser & { email: string };

export async function searchUserByEmail(email: string): Promise<UserSearchResult | null> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return null;
  const data = await apiPost<{ user: UserSearchResult | null }>("/api/follow", {
    action: "search",
    email: cleanEmail,
  });
  return data.user;
}

export async function followUser(uid: string): Promise<void> {
  await apiPost("/api/follow", { action: "follow", uid });
}

export async function unfollowUser(uid: string): Promise<void> {
  await apiPost("/api/follow", { action: "unfollow", uid });
}

// The people `uid` follows (or who follow them). Defaults to the current user.
export async function getFollowList(
  kind: "following" | "followers",
  uid?: string
): Promise<FollowUser[]> {
  const data = await apiPost<{ users: FollowUser[] }>("/api/follow", {
    action: "list",
    kind,
    uid,
  });
  return data.users;
}
