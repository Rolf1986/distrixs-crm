import { redirect } from "next/navigation";

// Producten zitten in offertes, niet in deals — stuur door naar offertes
export default async function DealProductsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/deals/${id}/quotes`);
}
