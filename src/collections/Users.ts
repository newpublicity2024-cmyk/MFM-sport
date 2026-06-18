import type { CollectionConfig } from "payload";

export const Users: CollectionConfig = {
  slug: "users",
  auth: true,
  labels: {
    singular: { en: "User", fr: "Utilisateur", ar: "مستخدم" },
    plural: { en: "Users", fr: "Utilisateurs", ar: "المستخدمون" },
  },
  admin: {
    useAsTitle: "email",
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      label: { en: "Name", fr: "Nom", ar: "الاسم" },
    },
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "editor",
      label: { en: "Role", fr: "Rôle", ar: "الصلاحية" },
      options: [
        { label: { en: "Admin", fr: "Administrateur", ar: "مدير" }, value: "admin" },
        { label: { en: "Editor", fr: "Éditeur", ar: "محرر" }, value: "editor" },
        { label: { en: "Viewer", fr: "Lecteur", ar: "مشاهد" }, value: "viewer" },
      ],
    },
  ],
};
