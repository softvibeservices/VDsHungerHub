// src\app\(admin)\settings\meal-cutoff\page.tsx

import { redirect } from "next/navigation";

export default function MealCutoffSettingsRedirect() {
  redirect("/profile/meal-cutoff");
}
