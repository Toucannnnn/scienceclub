import { redirect } from "next/navigation";
import { requireApprovedProfile, hasRole } from "@/lib/auth/dal";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireApprovedProfile();
  if (!hasRole(profile, "admin")) {
    redirect("/dashboard");
  }
  return children;
}
