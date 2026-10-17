import { createFileRoute, redirect } from "@tanstack/react-router";
import { getStaffAccess } from "@/lib/staff-access.functions";
import { canAccessStaff } from "@/lib/staff-access";

export const Route = createFileRoute("/_authenticated/partner/dashboard")({
  head: () => ({ meta: [
    { title: "Partner dashboard — Qless" },
    { name: "description", content: "Manage your assigned restaurant's Qless demonstration orders." },
    { property: "og:title", content: "Partner dashboard — Qless" },
    { property: "og:description", content: "Manage your assigned restaurant's Qless demonstration orders." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  beforeLoad: async () => {
    if (!canAccessStaff(await getStaffAccess())) throw redirect({ to: "/staff/login", search: { redirect: "/partner/dashboard" } });
    throw redirect({ to: "/merchant" });
  },
});