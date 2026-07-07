export const POINT_RULES = [
  { action: "publish", label: "Publish content", points: 15 },
  { action: "tip_received", label: "Receive a tip", points: 5 },
  { action: "duel_win", label: "Win a duel", points: 100 },
  { action: "duel_enter", label: "Enter a duel", points: 25 },
  { action: "vote", label: "Cast votes", points: 3 },
  { action: "referral", label: "Refer a friend", points: 50 },
] as const;

export type PointAction = (typeof POINT_RULES)[number]["action"];

export function pointsForAction(action: PointAction): number {
  return POINT_RULES.find((r) => r.action === action)?.points ?? 0;
}

export const PENNY_CONVERSION_NOTE =
  "1,000 PENNY points ≈ $1 USDC at launch.";

export const PENNY_LAUNCH_THRESHOLD = 1000;
export const PENNY_LAUNCH_USDC = 1;
