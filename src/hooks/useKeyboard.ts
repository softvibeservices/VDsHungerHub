import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useKeyboard() {
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts if the user is typing in an input, textarea, or select element
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          activeEl.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      
      switch (key) {
        case "k":
          e.preventDefault();
          router.push("/catalog");
          break;
        case "m":
          e.preventDefault();
          router.push("/daily-menu");
          break;
        case "d":
          e.preventDefault();
          router.push("/dashboard");
          break;
        case "o":
          e.preventDefault();
          router.push("/orders");
          break;
        case "c":
          e.preventDefault();
          router.push("/companies");
          break;
        case "u":
          e.preventDefault();
          router.push("/users");
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [router]);
}
