import { redirect } from "next/navigation";
import { resolveAuthState } from "@/lib/customer-auth";
import AuthTabs from "@/components/customer/AuthTabs";
import Footer from "@/components/public/Footer";

export const metadata = {
  title: "Verify Mobile | ViTa Cuisine",
  description: "Verify your mobile number to complete your ViTa Cuisine registration.",
};

export default async function VerifyPage() {
  const authState = await resolveAuthState();

  // If already logged in, redirect to menu
  if (authState.state === "VERIFIED_SESSION") {
    redirect("/menu");
  }

  const draftId = authState.state === "DRAFT_PENDING_VERIFICATION" ? authState.draftId : undefined;

  return (
    <>
      <AuthTabs activeTab="verify" draftId={draftId} />
      <Footer />
    </>
  );
}
