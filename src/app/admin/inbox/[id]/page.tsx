import AdminInboxPage from "../page";
import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/live-chat/security";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminInboxConversationPage({ params }: PageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const isAuth = Boolean(token && verifyAdminSessionToken(token));

  return <AdminInboxPage initialConversationId={id} initialAuthenticated={isAuth} />;
}

