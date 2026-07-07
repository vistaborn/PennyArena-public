"use client";

import { useState } from "react";
import { CheckCircle2, Copy, ExternalLink } from "lucide-react";
import { ARC_EXPLORER_TX } from "@/lib/arc";
import { formatUsdc } from "@/lib/pricing";
import { shortenAddress } from "@/lib/utils";

export type WithdrawReceiptData = {
  txHash: string;
  amountUsdc: number;
  fromAddress: string;
  toAddress: string;
  createdAt: string;
};

export function WithdrawReceipt({
  data,
  onDone,
}: {
  data: WithdrawReceiptData;
  onDone?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const explorerUrl = `${ARC_EXPLORER_TX}${data.txHash}`;
  const shortTx = `${data.txHash.slice(0, 8)}…${data.txHash.slice(-6)}`;

  const copyTx = async () => {
    await navigator.clipboard.writeText(data.txHash);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const rows: [string, string, boolean][] = [
    ["Amount", `${formatUsdc(data.amountUsdc)} USDC`, true],
    ["From", shortenAddress(data.fromAddress, 6), false],
    ["To", shortenAddress(data.toAddress, 6), false],
    ["Time", new Date(data.createdAt).toLocaleString(), false],
  ];

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-xl border border-penny-mint/30 bg-penny-mint/5 p-4 text-center sm:text-left">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-penny-mint/30 bg-penny-mint/10 px-2.5 py-1 text-xs font-medium text-penny-mint">
          <CheckCircle2 size={14} />
          Settled on Arc Testnet
        </span>
        <h4 className="mt-3 text-lg font-bold">Withdrawal receipt</h4>
        <p className="mt-1 text-sm text-[var(--muted)]">
          USDC sent from your PennyArena wallet.
        </p>
      </div>

      <dl className="space-y-3 text-sm">
        {rows.map(([label, value, bold]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-3"
          >
            <dt className="text-[var(--muted)]">{label}</dt>
            <dd className={bold ? "font-semibold" : "font-mono text-xs"}>{value}</dd>
          </div>
        ))}
        <div>
          <dt className="mb-1 text-[var(--muted)]">Transaction</dt>
          <dd className="flex items-center justify-between gap-2">
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="break-all font-mono text-xs text-penny-mint hover:underline"
            >
              {shortTx}
            </a>
            <button
              type="button"
              className="btn-secondary shrink-0 px-2 py-1 text-xs"
              onClick={copyTx}
            >
              <Copy size={14} />
              {copied ? "Copied" : "Copy"}
            </button>
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2 sm:flex-row">
        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="btn-primary flex flex-1 items-center justify-center gap-2"
        >
          <ExternalLink size={16} />
          View on ArcScan
        </a>
        {onDone ? (
          <button type="button" className="btn-secondary flex-1" onClick={onDone}>
            Done
          </button>
        ) : null}
      </div>
    </div>
  );
}
