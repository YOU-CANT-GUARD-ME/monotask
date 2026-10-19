// utils/crews.ts
// Study crews and the crew group-study room. All changes go through
// /api/crews; the live room's heartbeat and connection messages use
// Firestore directly (see app/group-study.tsx).

import { apiPost } from "./api";

export type CrewSummary = {
  id: string;
  name: string;
  code: string;
  memberCount: number;
  isOwner: boolean;
  liveCount: number;
};

export type CrewMember = {
  uid: string;
  displayName: string;
  isOwner: boolean;
  isMe: boolean;
  todayMs: number;
  weeklyMs: number;
  totalMs: number;
  streak: number;
};

export type CrewDetail = {
  crew: { id: string; name: string; code: string; memberCount: number; isOwner: boolean };
  members: CrewMember[];
  room: { maxSize: number; participants: { uid: string; displayName: string }[] };
};

export async function getMyCrews(): Promise<CrewSummary[]> {
  const data = await apiPost<{ crews: CrewSummary[] }>("/api/crews", { action: "mine" });
  return data.crews;
}

export async function createCrew(name: string) {
  const data = await apiPost<{ crew: { id: string; name: string; code: string } }>("/api/crews", {
    action: "create",
    name,
  });
  return data.crew;
}

export async function joinCrew(code: string) {
  const data = await apiPost<{ crew: { id: string; name: string; code: string } }>("/api/crews", {
    action: "join",
    code,
  });
  return data.crew;
}

export async function leaveCrew(crewId: string): Promise<void> {
  await apiPost("/api/crews", { action: "leave", crewId });
}

export async function getCrewDetail(crewId: string): Promise<CrewDetail> {
  return apiPost<CrewDetail>("/api/crews", {
    action: "detail",
    crewId,
    tzOffsetMinutes: new Date().getTimezoneOffset(),
  });
}

export async function joinCrewRoom(crewId: string): Promise<{ maxSize: number }> {
  return apiPost("/api/crews", { action: "roomJoin", crewId });
}

export async function leaveCrewRoom(crewId: string): Promise<void> {
  await apiPost("/api/crews", { action: "roomLeave", crewId });
}

// Strips the "API Error 409: " prefix so screens can show the server's message.
export function apiErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  const match = message.match(/^API Error \d+: (.+)$/);
  return match ? match[1] : fallback;
}
