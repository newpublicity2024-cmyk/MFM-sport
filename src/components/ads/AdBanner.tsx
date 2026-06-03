import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt: string;
  width: number;
  height: number;
  href?: string;
  priority?: boolean;
  className?: string;
};

// Full-bleed static sponsor/ad banner. NOT AdSense — for script-based ads see
// ads/AdSlot. Renders the image edge-to-edge at its natural aspect ratio so it is
// never cropped or zoomed (just give it the asset's intrinsic width/height).
export function AdBanner({ src, alt, width, height, href, priority, className }: Props) {
  const image = (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes="100vw"
      priority={priority}
      className="block h-auto w-full"
    />
  );

  return (
    <section className={cn("w-full", className)}>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="block">
          {image}
        </a>
      ) : (
        image
      )}
    </section>
  );
}
