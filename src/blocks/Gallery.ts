import type { Block } from "payload";

/**
 * A photo gallery: an array of images, each with its own optional caption.
 *
 * Deliberately an `array` field of `{ image, caption }` rows rather than a single
 * `hasMany` upload relationship — a `hasMany` upload has nowhere to hang a per-image
 * caption, and per-image captions are the whole point of a gallery over a bare list of
 * photos. Renderer is Task 5; this task only defines the shape that lands in the DB.
 */
export const GalleryBlock: Block = {
  slug: "gallery",
  interfaceName: "GalleryBlock",
  labels: {
    singular: { en: "Photo gallery", fr: "Galerie photo", ar: "معرض صور" },
    plural: { en: "Photo galleries", fr: "Galeries photo", ar: "معارض صور" },
  },
  fields: [
    {
      name: "images",
      type: "array",
      required: true,
      label: { en: "Images", fr: "Images", ar: "الصور" },
      labels: {
        singular: { en: "Image", fr: "Image", ar: "صورة" },
        plural: { en: "Images", fr: "Images", ar: "الصور" },
      },
      admin: {
        description: {
          en: "Add two or more images. They appear in the order you set here, and each can carry its own caption.",
          fr: "Ajoutez deux images ou plus. Elles s'affichent dans l'ordre choisi ici, et chacune peut avoir sa propre légende.",
          ar: "أضف صورتين أو أكثر. تظهر بالترتيب الذي تحدّده هنا، ويمكن لكل صورة أن تحمل تعليقها الخاص.",
        },
      },
      fields: [
        {
          name: "image",
          type: "upload",
          relationTo: "media",
          required: true,
          label: { en: "Image", fr: "Image", ar: "الصورة" },
        },
        {
          name: "caption",
          type: "text",
          label: { en: "Caption", fr: "Légende", ar: "التعليق" },
        },
      ],
    },
    {
      name: "layout",
      type: "select",
      required: true,
      defaultValue: "grid",
      label: { en: "Layout", fr: "Disposition", ar: "طريقة العرض" },
      options: [
        { label: { en: "Grid", fr: "Grille", ar: "شبكة" }, value: "grid" },
        { label: { en: "Carousel", fr: "Carrousel", ar: "عرض دوّار" }, value: "carousel" },
      ],
      admin: {
        description: {
          en: "How the gallery is displayed on the article page.",
          fr: "Comment la galerie s'affiche sur la page de l'article.",
          ar: "طريقة عرض المعرض في صفحة المقال.",
        },
      },
    },
  ],
};
