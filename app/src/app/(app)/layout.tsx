import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  return (
    <div className="flex">
      <Sidebar userName={session.user.name ?? session.user.email} />
      <main className="flex-1 p-6 bg-base min-h-screen">
        {children}
      </main>
    </div>
  );
}
