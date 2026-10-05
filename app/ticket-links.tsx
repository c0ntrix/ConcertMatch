import { ArrowUpRight } from "lucide-react";
import { isReservixAffiliateLink } from "@/lib/reservix-events";
import type { Concert } from "@/lib/types";

export default function TicketLinks({
  concert,
  detail = false,
}: {
  concert: Concert;
  detail?: boolean;
}) {
  const allOffers = [
    ...(concert.offers || [{ source: concert.source, url: concert.url }]),
  ].sort(
    (a, b) =>
      Number(isReservixAffiliateLink(b.url)) -
      Number(isReservixAffiliateLink(a.url)),
  );
  const offers = allOffers.filter(
    (offer, index) =>
      allOffers.findIndex((other) => other.source === offer.source) === index,
  );
  const affiliate = offers.some((offer) => isReservixAffiliateLink(offer.url));
  return (
    <>
      {offers.map((offer) => {
        const affiliate = isReservixAffiliateLink(offer.url);
        return (
          <a
            key={offer.url}
            className={detail ? "secondary small" : "ticket-link"}
            href={offer.url}
            target="_blank"
            rel={
              affiliate
                ? "sponsored noopener noreferrer"
                : "noopener noreferrer"
            }
            aria-label={`Tickets für ${concert.title} bei ${offer.source} ansehen${affiliate ? " (Werbelink)" : ""} (öffnet in neuem Tab)`}
            title={`Verfügbarkeit bei ${offer.source} prüfen${affiliate ? ". Bei einem vergütbaren Kauf erhalten wir eine Provision." : ""}`}
          >
            {offers.length > 1 || affiliate
              ? `Tickets bei ${offer.source}`
              : detail
                ? "Termin & Tickets"
                : "Tickets ansehen"}
            {affiliate && <span aria-hidden="true">*</span>}
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        );
      })}
      {affiliate && (
        <small className="affiliate-label">
          * Bei Kauf erhalten wir eine Provision.
        </small>
      )}
    </>
  );
}
