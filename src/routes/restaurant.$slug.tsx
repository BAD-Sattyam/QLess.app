import { createFileRoute } from "@tanstack/react-router";
import { CafeView } from "@/components/CafeView";

export const Route = createFileRoute("/restaurant/$slug")({
  head: () => ({
    meta: [
      { title: "Restaurant — Qless" },
      { name: "description", content: "Browse the menu, pick a time, prepay and skip the queue." },
      { property: "og:title", content: "Restaurant — Qless" },
      { property: "og:description", content: "Browse the menu, pick a time, prepay and skip the queue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: function RestaurantPage() {
    const { slug } = Route.useParams();
    return <CafeView slug={slug} />;
  },
});
