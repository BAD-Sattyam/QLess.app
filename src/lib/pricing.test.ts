import { describe, expect, it } from "vitest";
import { estimateUnitPrice, formatINR } from "./pricing";

const groups = [
  { name: "Size", options: [{ label: "Regular", price_paise: 0 }, { label: "Large", price_paise: 4000 }] },
  { name: "Milk", options: [{ label: "Dairy", price_paise: 0 }, { label: "Oat", price_paise: 5000 }] },
];

describe("pricing", () => {
  it("defaults to the first option of each group", () => {
    expect(estimateUnitPrice(18000, groups, {})).toBe(18000);
  });
  it("adds option surcharges in paise", () => {
    expect(estimateUnitPrice(18000, groups, { Size: "Large", Milk: "Oat" })).toBe(27000);
  });
  it("formats paise as rupees", () => {
    expect(formatINR(18000)).toBe("₹180");
  });
});
