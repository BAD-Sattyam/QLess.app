import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy path — restaurant pages live at /restaurant/$slug.
export const Route = createFileRoute("/cafe/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/restaurant/$slug", params: { slug: params.slug }, replace: true });
  },
});
