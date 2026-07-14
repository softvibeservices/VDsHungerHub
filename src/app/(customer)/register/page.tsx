import { redirect } from "next/navigation";
import { resolveAuthState } from "@/lib/customer-auth";
import AuthTabs from "@/components/customer/AuthTabs";

export const metadata = {
  title: "Register | VD's Hunger Hub",
  description: "Create an account to start ordering delicious home-style thalis.",
};

export default async function RegisterPage() {
  const authState = await resolveAuthState();

  // If already logged in, redirect to menu
  if (authState.state === "VERIFIED_SESSION") {
    redirect("/menu");
  }

  return (
    <div className="min-h-[80vh] flex flex-col justify-center">
      <AuthTabs activeTab="register" />
    </div>
  );
}
