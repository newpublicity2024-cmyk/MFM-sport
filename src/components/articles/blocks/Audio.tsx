import type { Media } from "@/payload-types";

type Props = {
  file: number | Media | null | undefined;
  title?: string | null;
};

/**
 * Native `<audio preload="none">`. No player library -- it would blow the JS
 * budget for a control the browser already ships.
 */
export function Audio({ file, title }: Props) {
  const media = typeof file === "object" && file !== null ? file : null;
  const src = media?.url;
  if (!src) return null;

  return (
    <figure className="my-6">
      {title && (
        <figcaption className="mb-2 text-sm font-medium text-foreground" dir="rtl">
          {title}
        </figcaption>
      )}
      <audio controls preload="none" className="w-full">
        <source src={src} type={media?.mimeType ?? undefined} />
        <a href={src}>{title || "تنزيل الملف الصوتي"}</a>
      </audio>
    </figure>
  );
}
