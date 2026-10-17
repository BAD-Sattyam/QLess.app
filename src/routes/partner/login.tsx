import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/partner/login")({
  head: () => ({ meta: [
    { title: "Partner sign in — Qless" },
    { name: "description", content: "Secure sign-in for assigned Qless restaurant staff." },
    { property: "og:title", content: "Partner sign in — Qless" },
    { property: "og:description", content: "Secure sign-in for assigned Qless restaurant staff." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  beforeLoad: () => { throw redirect({ to: "/staff/login", search: { redirect: "/partner/dashboard" } }); },
});