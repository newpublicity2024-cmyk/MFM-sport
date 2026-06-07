// src/components/social/socialLinks.ts
import {
  FacebookIcon,
  InstagramIcon,
  XIcon,
  YoutubeIcon,
  type SocialIcon,
} from "./icons";

export type SocialLink = {
  name: string;
  href: string;
  Icon: SocialIcon;
  /** Tailwind background class for the brand color (glyph is rendered white on top). */
  bgClass: string;
};

// Instagram's signature multi-stop gradient (no spaces — Tailwind arbitrary value).
const INSTAGRAM_GRADIENT =
  "bg-[linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)]";

// Single source of truth for MFM Sport's real social URLs + brand colors.
export const SOCIAL_LINKS = {
  facebook: { name: "Facebook", href: "https://facebook.com/Mfmsport.ma", Icon: FacebookIcon, bgClass: "bg-[#1877F2]" },
  instagram: { name: "Instagram", href: "https://instagram.com/mfmsportofficiel", Icon: InstagramIcon, bgClass: INSTAGRAM_GRADIENT },
  x: { name: "X", href: "https://x.com/MfmSport", Icon: XIcon, bgClass: "bg-black" },
  youtube: { name: "YouTube", href: "https://youtube.com/@mfmsport1430", Icon: YoutubeIcon, bgClass: "bg-[#FF0000]" },
} satisfies Record<string, SocialLink>;

// Footer keeps showing all four, in the existing order.
export const FOOTER_SOCIALS: SocialLink[] = [
  SOCIAL_LINKS.facebook,
  SOCIAL_LINKS.instagram,
  SOCIAL_LINKS.x,
  SOCIAL_LINKS.youtube,
];

// The floater's MAIN button is Instagram; the dropdown lists the OTHER three
// (Instagram is never duplicated). Order requested by owner: YouTube, Facebook, X.
export const FLOATER_MAIN: SocialLink = SOCIAL_LINKS.instagram;
export const FLOATER_DROPDOWN: SocialLink[] = [
  SOCIAL_LINKS.youtube,
  SOCIAL_LINKS.facebook,
  SOCIAL_LINKS.x,
];
