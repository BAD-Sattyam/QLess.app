import { createFileRoute } from "@tanstack/react-router";
import { CafeView } from "@/components/CafeView";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CoffeeSkip — Pre-order at your office café" },
      { name: "description", content: "Order coffee, chai and snacks ahead, pick a time, and skip the queue. Pay at pickup." },
      { property: "og:title", content: "CoffeeSkip — Pre-order at your office café" },
      { property: "og:description", content: "Order ahead, pick a time, skip the queue. Pay at pickup." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <CafeView />,
});
