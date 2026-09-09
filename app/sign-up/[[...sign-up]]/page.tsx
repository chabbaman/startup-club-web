import { SignUp } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function SignUpPage() {
  const { isAuthenticated } = await auth();
  if (isAuthenticated) redirect("/dashboard");

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-sky-100 via-amber-50 to-rose-100 px-4 py-12">
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-sky-300/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-rose-300/50 blur-3xl" />
      <div className="relative z-10 mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          Join the Startup Club Board
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Only <span className="font-semibold">@dlshs.org</span> and{" "}
          <span className="font-semibold">@carondeleths.org</span> emails can sign up.
        </p>
      </div>
      <div className="relative z-10">
        <SignUp />
      </div>
    </main>
  );
}
