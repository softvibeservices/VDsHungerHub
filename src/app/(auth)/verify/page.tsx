import { redirect } from "next/navigation";
import { resolveAuthState } from "@/lib/customer-auth";
import AuthTabs from "@/components/customer/AuthTabs";

export const metadata = {
  title: "Verify Mobile | VD's Hunger Hub",
  description: "Verify your mobile number to complete registration.",
};

export default async function VerifyPage() {
  const authState = await resolveAuthState();

  // If already logged in, redirect to menu
  if (authState.state === "VERIFIED_SESSION") {
    redirect("/menu");
  }

  const draftId = authState.state === "DRAFT_PENDING_VERIFICATION" ? authState.draftId : undefined;

  return (
    <div className="min-h-[80vh] flex flex-col justify-center">
      <AuthTabs activeTab="verify" draftId={draftId} />
    </div>
  );
}
