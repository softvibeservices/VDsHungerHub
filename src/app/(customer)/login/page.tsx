import { redirect } from "next/navigation";
import { resolveAuthState } from "@/lib/customer-auth";
import AuthTabs from "@/components/customer/AuthTabs";

export const metadata = {
  title: "Login | VD's Hunger Hub",
  description: "Sign in to place your daily thali order.",
};

export default async function LoginPage() {
  const authState = await resolveAuthState();

  // If already logged in, redirect to menu
  if (authState.state === "VERIFIED_SESSION") {
    redirect("/menu");
  }

  return (
    <div className="min-h-[80vh] flex flex-col justify-center">
      <AuthTabs activeTab="login" />
    </div>
  );
}
