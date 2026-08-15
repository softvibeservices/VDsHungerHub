// src\app\(admin)\catalog\page.tsx

import { redirect } from "next/navigation";

export default function CatalogIndexPage() {
  redirect("/catalog/products");
}
