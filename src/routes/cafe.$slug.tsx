import { createFileRoute } from "@tanstack/react-router";
import { CafeView } from "@/components/CafeView";

export const Route = createFileRoute("/cafe/$slug")({
  head: () => ({
    meta: [
      { title: "Café menu — Qless" },
      { name: "description", content: "Browse the menu and pre-order for pickup." },
      { property: "og:title", content: "Café menu — Qless" },
      { property: "og:description", content: "Browse the menu and pre-order for pickup." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CafePage,
});

function CafePage() {
  const { slug } = Route.useParams();
  return <CafeView slug={slug} />;
}
