import { auth, currentUser } from "@clerk/nextjs/server";
import { SignOutButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { Button, Card, Chip } from "@heroui/react";
import { isAllowedEmail, isTeacherEmail } from "@/lib/allowed";
import { Dashboard } from "@/components/Dashboard";

export default async function DashboardPage() {
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) redirect("/");

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  if (!isAllowedEmail(email)) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-4">
        <Card className="max-w-md">
          <Card.Header>
            <Card.Title>Members only</Card.Title>
            <Card.Description>
              This account is not a school address, so it cannot access the Startup Club board.
            </Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-wrap items-center gap-2 text-sm">
            <Chip color="danger" variant="soft" size="sm">
              {email ?? "no email"}
            </Chip>
            <span className="text-muted">needs to be</span>
            <Chip variant="soft" size="sm">
              @dlshs.org
            </Chip>
            <span className="text-muted">or</span>
            <Chip variant="soft" size="sm">
              @carondeleths.org
            </Chip>
          </Card.Content>
          <Card.Footer>
            <SignOutButton redirectUrl="/">
              <Button variant="danger">Sign out and try another account</Button>
            </SignOutButton>
          </Card.Footer>
        </Card>
      </main>
    );
  }

  return <Dashboard isTeacher={isTeacherEmail(email)} />;
}
