const shareIconClass = "shrink-0 object-contain brightness-0 invert";

export function TelegramIcon({ size = 16 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icons/telegram.png"
      alt=""
      width={size}
      height={size}
      className={shareIconClass}
    />
  );
}

export function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icons/whatsapp.png"
      alt=""
      width={size}
      height={size}
      className={shareIconClass}
    />
  );
}

export function UsdcIcon({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/usdc.png"
        alt="USDC"
        className="max-h-full max-w-full object-contain"
        style={{ width: size, height: size }}
      />
    </span>
  );
}

export function TwitterIcon({ size = 16 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center font-bold leading-none text-[var(--fg)]"
      style={{ width: size, height: size, fontSize: size * 0.8 }}
      aria-hidden
    >
      𝕏
    </span>
  );
}

export function ShareMenuIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-4 w-5 shrink-0 items-center justify-center">{children}</span>
  );
}
