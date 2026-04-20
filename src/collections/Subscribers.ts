import type { CollectionConfig } from "payload";

export const Subscribers: CollectionConfig = {
  slug: "subscribers",
  admin: {
    useAsTitle: "email",
    defaultColumns: ["email", "status", "locale", "createdAt"],
  },
  fields: [
    { name: "email", type: "email", required: true, unique: true },
    {
      name: "locale",
      type: "select",
      required: true,
      defaultValue: "ar",
      options: [
        { label: "العربية", value: "ar" },
        { label: "Français", value: "fr" },
        { label: "English", value: "en" },
      ],
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Confirmed", value: "confirmed" },
        { label: "Unsubscribed", value: "unsubscribed" },
      ],
      admin: { position: "sidebar" },
    },
    { name: "confirmToken", type: "text", admin: { readOnly: true, condition: () => false } },
    { name: "confirmedAt", type: "date", admin: { position: "sidebar", readOnly: true } },
  ],
};
