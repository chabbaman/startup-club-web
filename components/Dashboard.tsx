"use client";

import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { Authenticated, AuthLoading, useMutation } from "convex/react";
import { Spinner, Tabs } from "@heroui/react";
import { api } from "@/convex/_generated/api";
import { Board } from "./Board";
import { TeacherPanel } from "./TeacherPanel";

type Tab = "board" | "teacher";

export function Dashboard({ isTeacher }: { isTeacher: boolean }) {
  const [tab, setTab] = useState<Tab>("board");

  const brand = (
    <div className="flex items-center gap-3">
      <span className="text-2xl font-black leading-none text-foreground">?</span>
      <h1 className="text-lg font-bold tracking-tight text-foreground">Startup Club Board</h1>
    </div>
  );

  const loading = (
    <div className="flex flex-1 items-center justify-center">
      <Spinner />
    </div>
  );

  if (!isTeacher) {
    return (
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border bg-surface/80 px-4 py-3 backdrop-blur sm:px-6">
          {brand}
          <UserButton />
        </header>
        <AuthLoading>{loading}</AuthLoading>
        <Authenticated>
          <RegisterUser />
          <Board />
        </Authenticated>
      </div>
    );
  }

  return (
    <Tabs
      selectedKey={tab}
      onSelectionChange={(key) => setTab(key as Tab)}
      className="flex flex-1 flex-col"
    >
      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border bg-surface/80 px-4 py-3 backdrop-blur sm:px-6">
        {brand}
        <div className="flex items-center gap-4">
          <Tabs.ListContainer>
            <Tabs.List aria-label="Dashboard views">
              <Tabs.Tab id="board" className="whitespace-nowrap">
                Board
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="teacher" className="whitespace-nowrap">
                Teacher view
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          <UserButton />
        </div>
      </header>

      <AuthLoading>{loading}</AuthLoading>
      <Authenticated>
        <RegisterUser />
        <Tabs.Panel id="board" className="flex flex-1 flex-col">
          <Board />
        </Tabs.Panel>
        <Tabs.Panel id="teacher" className="flex flex-1 flex-col">
          <TeacherPanel />
        </Tabs.Panel>
      </Authenticated>
    </Tabs>
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
