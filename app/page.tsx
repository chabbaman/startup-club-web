import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const { isAuthenticated } = await auth();
  if (isAuthenticated) redirect("/dashboard");

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-rose-100 via-amber-50 to-sky-100 px-4 py-12">
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-rose-300/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-sky-300/50 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-200/50 blur-3xl" />

      <div className="relative z-10 mb-8 text-center">
        <div className="mb-3 flex items-center justify-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-rose-500" />
          <span className="h-3 w-3 rounded-full bg-amber-400" />
          <span className="h-3 w-3 rounded-full bg-teal-400" />
          <span className="h-3 w-3 rounded-full bg-violet-500" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900">
          Startup Club Board
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Sign in with your <span className="font-semibold">@dlshs.org</span> or{" "}
          <span className="font-semibold">@carondeleths.org</span> account.
        </p>
      </div>

      <div className="relative z-10">
        <SignIn routing="hash" />
      </div>
    </main>
  );
}
