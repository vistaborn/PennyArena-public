export const TOPICS = [
  { slug: "arc-testnet", title: "Arc Testnet", emoji: "⛓️" },
  { slug: "circle-modular-wallets", title: "Circle Modular Wallets", emoji: "👛" },
  { slug: "usdc-nanopayments", title: "USDC Nanopayments", emoji: "💲" },
  { slug: "ai-agents", title: "AI Agents", emoji: "🤖" },
  { slug: "web3-design", title: "Web3 Design", emoji: "🎨" },
  { slug: "defi", title: "DeFi", emoji: "📊" },
  { slug: "smart-contracts", title: "Smart Contracts", emoji: "📜" },
  { slug: "memes", title: "Memes", emoji: "😂" },
  { slug: "crypto-news", title: "Crypto News", emoji: "📰" },
  { slug: "stablecoins", title: "Stablecoins", emoji: "💵" },
  { slug: "prediction-markets", title: "Prediction Markets", emoji: "🔮" },
  { slug: "gaming", title: "Gaming", emoji: "🎮" },
  { slug: "music", title: "Music", emoji: "🎵" },
  { slug: "photography", title: "Photography", emoji: "📷" },
] as const;

export type TopicSlug = (typeof TOPICS)[number]["slug"];

export function getTopic(slug: string) {
  return TOPICS.find((t) => t.slug === slug);
}

export function isValidTopicSlug(slug: string): slug is TopicSlug {
  return TOPICS.some((t) => t.slug === slug);
}
