"use client";

import { createContext, useContext } from "react";
import type { UserProfile } from "./api/types";

const SessionContext = createContext<UserProfile | null>(null);

export function SessionProvider({
  user,
  children,
}: {
  user: UserProfile | null;
  children: React.ReactNode;
}) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSession(): UserProfile | null {
  return useContext(SessionContext);
}
