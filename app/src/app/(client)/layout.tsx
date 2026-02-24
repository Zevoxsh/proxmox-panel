import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        isAdmin={session.user.role === "ADMIN"}
        userName={session.user.name}
        userEmail={session.user.email}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar
          userName={session.user.name}
          userEmail={session.user.email}
          isAdmin={session.user.role === "ADMIN"}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
