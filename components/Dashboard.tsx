"use client";

import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { Authenticated, AuthLoading, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Board } from "./Board";
import { TeacherPanel } from "./TeacherPanel";

type Tab = "board" | "teacher";

export function Dashboard({ isTeacher }: { isTeacher: boolean }) {
  const [tab, setTab] = useState<Tab>("board");

  return (
    <div className="flex flex-1 flex-col bg-gradient-to-br from-rose-50 via-amber-50 to-sky-50">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-white/60 bg-white/70 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-teal-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-900">Startup Club Board</h1>
          <span className="hidden items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 sm:inline-flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            live
          </span>
        </div>

        {isTeacher && (
          <nav className="flex rounded-xl bg-white/80 p-1 ring-1 ring-black/5">
            <TabButton active={tab === "board"} onClick={() => setTab("board")}>
              Board
            </TabButton>
            <TabButton active={tab === "teacher"} onClick={() => setTab("teacher")}>
              Teacher view
            </TabButton>
          </nav>
        )}

        <UserButton />
      </header>

      <AuthLoading>
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
          Loading…
        </div>
      </AuthLoading>
      <Authenticated>
        <RegisterUser />
        {tab === "teacher" && isTeacher ? <TeacherPanel /> : <Board />}
      </Authenticated>
    </div>
  );
}

/** Records the signed-in member so teachers can assign them roles. */
function RegisterUser() {
  const ensureUser = useMutation(api.roles.ensureUser);
  useEffect(() => {
    void ensureUser();
  }, [ensureUser]);
  return null;
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
        active ? "bg-zinc-900 text-white shadow" : "text-zinc-500 hover:text-zinc-900"
      }`}
    >
      {children}
    </button>
  );
}
