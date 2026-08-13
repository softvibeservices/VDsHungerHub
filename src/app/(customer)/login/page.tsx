import { redirect } from "next/navigation";
import { resolveAuthState } from "@/lib/customer-auth";
import AuthTabs from "@/components/customer/AuthTabs";
import Footer from "@/components/public/Footer";

export const metadata = {
  title: "Login | ViTa Cuisine",
  description: "Sign in to your ViTa Cuisine account and place your daily thali order.",
};

export default async function LoginPage() {
  const authState = await resolveAuthState();

  // If already logged in, redirect to menu
  if (authState.state === "VERIFIED_SESSION") {
    redirect("/menu");
  }

  return (
    <>
      <AuthTabs activeTab="login" />
      <Footer />
    </>
  );
}
