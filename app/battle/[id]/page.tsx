import { BattleDetailClient } from "@/components/battle-detail";

export default async function BattleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BattleDetailClient duelId={id} />;
}
