import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { PublicConfig } from "./types";

const FALLBACK: PublicConfig = {
  businessName: "Nyumbani",
  businessTagline: "Quality goods, made to order",
  ussdServiceCode: "*384*38239#",
  ownerPhone: "+254715639940",
};

/** Public branding config from the API; falls back to neutral values while loading. */
export function usePublicConfig(): PublicConfig {
  const { data } = useQuery({
    queryKey: ["public-config"],
    queryFn: () => api.get<PublicConfig>("/api/config"),
    staleTime: Infinity,
  });
  return data ?? FALLBACK;
}

/** +254715639940 → +254 715 639 940 (best effort; returns input if unrecognized). */
export function formatPhone(e164: string): string {
  const m = e164.match(/^(\+\d{3})(\d{3})(\d{3})(\d{3})$/);
  return m ? `${m[1]} ${m[2]} ${m[3]} ${m[4]}` : e164;
}
