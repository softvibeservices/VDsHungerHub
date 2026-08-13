import { redirect } from "next/navigation";
import { resolveAuthState } from "@/lib/customer-auth";
import AuthTabs from "@/components/customer/AuthTabs";
import Footer from "@/components/public/Footer";

export const metadata = {
  title: "Register | ViTa Cuisine",
  description: "Create your ViTa Cuisine account to start ordering fresh home-style meals.",
};

export default async function RegisterPage() {
  const authState = await resolveAuthState();

  // If already logged in, redirect to menu
  if (authState.state === "VERIFIED_SESSION") {
    redirect("/menu");
  }

  return (
    <>
      <AuthTabs activeTab="register" />
      <Footer />
    </>
  );
}
