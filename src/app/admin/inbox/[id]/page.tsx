import AdminInboxPage from "../page";
import { cookies } from "next/headers";
import { validateAdminSession } from "@/lib/live-chat/session-registry";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminInboxConversationPage({ params }: PageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const auth = await validateAdminSession({ cookies: cookieStore });

  return <AdminInboxPage initialConversationId={id} initialAuthenticated={auth.authenticated} />;
}

