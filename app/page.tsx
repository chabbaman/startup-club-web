import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Chip } from "@heroui/react";

export default async function Home() {
  const { isAuthenticated } = await auth();
  if (isAuthenticated) redirect("/dashboard");

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="text-6xl font-black leading-none text-foreground">?</span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground">
          Startup Club Board
        </h1>
        <p className="mt-2 text-sm text-muted">Sign in with your school account.</p>
        <div className="mt-3 flex gap-2">
          <Chip color="accent" variant="soft" size="sm">
            @dlshs.org
          </Chip>
          <Chip color="accent" variant="soft" size="sm">
            @carondeleths.org
          </Chip>
        </div>
      </div>

      <SignIn routing="hash" />
    </main>
  );
}
