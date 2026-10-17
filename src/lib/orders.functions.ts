import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const orderSchema = z.object({
  cafeId: z.string().uuid(),
  customerName: z.string().trim().min(1, "Please enter your name").max(60),
  notes: z.string().trim().max(300).optional().default(""),
  pickupAt: z.string().datetime({ offset: true }),
  website: z.string().max(0).optional(), // honeypot – must stay empty
  items: z
    .array(
      z.object({
        menu_item_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(10),
        options: z.record(z.string().max(40), z.string().max(40)).default({}),
      }),
    )
    .min(1, "Your cart is empty")
    .max(20),
});

async function sha256(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => orderSchema.parse(input))
  .handler(async ({ data }) => {
    const ip =
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const ua = getRequestHeader("user-agent") ?? "";
    const clientHash = await sha256(`${ip}|${ua}`);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("place_order", {
      p_cafe_id: data.cafeId,
      p_customer_name: data.customerName,
      p_notes: data.notes ?? "",
      p_pickup_at: data.pickupAt,
      p_items: data.items,
      p_client_hash: clientHash,
    });
    if (error) return { ok: false as const, error: error.message };
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return { ok: false as const, error: "Could not place order" };
    return { ok: true as const, token: row.tracking_token as string, code: row.pickup_code as string };
  });
