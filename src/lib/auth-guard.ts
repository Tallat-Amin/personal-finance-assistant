import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }
  return session.user.id;
}
