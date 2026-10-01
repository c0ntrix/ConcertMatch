import type { Concert } from "./types";

// Unknown prices and foreign currencies cannot satisfy an EUR budget.
export function withinEuroBudget(
  concert: Pick<Concert, "price" | "currency">,
  budget: number,
) {
  return (
    !budget ||
    (concert.price !== undefined &&
      Number.isFinite(concert.price) &&
      concert.price >= 0 &&
      concert.currency === "EUR" &&
      concert.price <= budget)
  );
}
