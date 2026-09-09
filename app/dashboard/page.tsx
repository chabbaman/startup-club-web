import { auth, currentUser } from "@clerk/nextjs/server";
import { SignOutButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { isAllowedEmail, isTeacherEmail } from "@/lib/allowed";
import { Dashboard } from "@/components/Dashboard";

export default async function DashboardPage() {
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) redirect("/");

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  if (!isAllowedEmail(email)) {
    return (
      <main className="relative flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-rose-100 via-amber-50 to-sky-100 px-4 text-center">
        <div className="relative z-10 max-w-md rounded-2xl border border-rose-200 bg-white/80 p-8 shadow-xl backdrop-blur">
          <h1 className="text-2xl font-bold text-zinc-900">Members only</h1>
          <p className="mt-3 text-sm text-zinc-600">
            <span className="font-mono">{email ?? "This account"}</span> is not a{" "}
            <span className="font-semibold">@dlshs.org</span> or{" "}
            <span className="font-semibold">@carondeleths.org</span> address, so it
            cannot access the Startup Club board.
          </p>
          <SignOutButton redirectUrl="/">
            <button className="mt-6 rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-rose-600">
              Sign out and try another account
            </button>
          </SignOutButton>
        </div>
      </main>
    );
  }

  return <Dashboard isTeacher={isTeacherEmail(email)} />;
}
