import { redirect } from "next/navigation";

// Oude loginpagina — vervangen door /login (met captcha + bot-bescherming).
// Doorsturen zodat oude bladwijzers/links blijven werken.
export default function InloggenRedirect() {
  redirect("/login");
}
