import Image from "next/image";
import Link from "next/link";

// Compact: header nav — logo + "WK Poule" text
// Large: login page — logo prominently centered
// href: optional, wraps in a Link when set
export default function BrandLogo({
  size = "compact",
  href,
}: {
  size?: "compact" | "large";
  href?: string;
}) {
  if (size === "large") {
    return (
      <div className="flex flex-col items-center gap-2">
        <Image
          src="/nijhuis-logo.png"
          alt="Nijhuis Bouw"
          width={1200}
          height={645}
          className="w-48 h-auto object-contain"
          priority
        />
        <span className="text-lg font-bold tracking-tight">Nijhuis Bouw WK Poule 2026</span>
      </div>
    );
  }

  const inner = (
    <div className="flex items-center gap-2.5">
      {/* Crop bottom "Nijhuis Bouw B.V." text via overflow-hidden so de mark
          visueel uitlijnt met de WK Poule tekst. */}
      <div className="h-7 overflow-hidden flex items-start shrink-0">
        <Image
          src="/nijhuis-logo.png"
          alt="Nijhuis Bouw"
          width={1200}
          height={645}
          className="h-10 w-auto max-w-none"
          priority
        />
      </div>
      <span className="font-bold text-sm leading-tight">WK Poule</span>
    </div>
  );

  if (href) return <Link href={href} className="hover:opacity-80 transition-opacity">{inner}</Link>;
  return inner;
}
