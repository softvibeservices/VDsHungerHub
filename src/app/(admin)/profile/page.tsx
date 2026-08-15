// src\app\(admin)\profile\page.tsx

import { redirect } from "next/navigation";

export default function ProfileIndexPage() {
  redirect("/profile/password");
}
