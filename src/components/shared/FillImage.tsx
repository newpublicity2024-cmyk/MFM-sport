import Image from "next/image";

type Props = {
  src: string;
  alt: string;
  /** next/image `sizes` hint for the foreground image. */
  sizes?: string;
  priority?: boolean;
  /** Extra classes for the outer frame (sizing is owned by the caller). */
  className?: string;
};

/**
 * Renders an image that shows in FULL (never cropped) while still filling its
 * frame edge-to-edge. A blurred, cover-fitted copy of the same image paints the
 * background so there are no empty letterbox bars; the real image sits on top
 * via object-contain so nothing is zoomed in or cropped out.
 *
 * The caller owns the frame size (e.g. `aspect-video`, `h-full`); this fills it.
 */
export function FillImage({ src, alt, sizes = "100vw", priority, className }: Props) {
  return (
    <div className={`relative h-full w-full overflow-hidden ${className ?? ""}`}>
      {/* Blurred background fill — cropping is irrelevant since it's blurred. */}
      <Image
        src={src}
        alt=""
        aria-hidden
        fill
        sizes={sizes}
        className="scale-110 object-cover blur-2xl"
      />
      <div className="absolute inset-0 bg-background/10" />
      {/* The actual image, shown whole. */}
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-contain"
      />
    </div>
  );
}
