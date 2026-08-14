import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export function isAllowedEmail(email: string | null | undefined): boolean {
  const allowed = process.env.ALLOWED_GOOGLE_EMAIL;
  return Boolean(email && allowed && email === allowed);
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.email || !isAllowedEmail(session.user.email)) {
    redirect("/");
  }
  return session;
}
