import type { CollectionConfig } from "payload";

export const Subscribers: CollectionConfig = {
  slug: "subscribers",
  labels: {
    singular: { en: "Subscriber", fr: "Abonné", ar: "مشترك" },
    plural: { en: "Subscribers", fr: "Abonnés", ar: "المشتركون" },
  },
  admin: {
    useAsTitle: "email",
    defaultColumns: ["email", "status", "locale", "createdAt"],
  },
  fields: [
    {
      name: "email",
      type: "email",
      required: true,
      unique: true,
      label: { en: "Email", fr: "E-mail", ar: "البريد الإلكتروني" },
    },
    {
      name: "locale",
      type: "select",
      required: true,
      defaultValue: "ar",
      label: { en: "Language", fr: "Langue", ar: "اللغة" },
      options: [
        { label: { en: "Arabic", fr: "Arabe", ar: "العربية" }, value: "ar" },
        { label: { en: "French", fr: "Français", ar: "الفرنسية" }, value: "fr" },
        { label: { en: "English", fr: "Anglais", ar: "الإنجليزية" }, value: "en" },
      ],
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      label: { en: "Status", fr: "Statut", ar: "الحالة" },
      options: [
        { label: { en: "Pending", fr: "En attente", ar: "قيد الانتظار" }, value: "pending" },
        { label: { en: "Confirmed", fr: "Confirmé", ar: "مؤكَّد" }, value: "confirmed" },
        { label: { en: "Unsubscribed", fr: "Désabonné", ar: "ملغى الاشتراك" }, value: "unsubscribed" },
      ],
      admin: { position: "sidebar" },
    },
    {
      name: "confirmToken",
      type: "text",
      label: { en: "Confirmation token", fr: "Jeton de confirmation", ar: "رمز التأكيد" },
      admin: { readOnly: true, condition: () => false },
    },
    {
      name: "confirmedAt",
      type: "date",
      label: { en: "Confirmed at", fr: "Confirmé le", ar: "تاريخ التأكيد" },
      admin: { position: "sidebar", readOnly: true },
    },
  ],
};
