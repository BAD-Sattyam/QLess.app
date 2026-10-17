import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orderSchema.parse(input))
  .handler(async () => {
    // Legacy RPC remains callable for compatibility, but cannot bypass prepaid checkout.
    return { ok: false as const, error: "Use verified prepaid checkout. Test payments do not create preparation orders." };
  });
