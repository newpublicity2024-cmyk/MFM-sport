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
};

// Single source of truth for MFM Sport's real social URLs.
export const SOCIAL_LINKS = {
  facebook: { name: "Facebook", href: "https://facebook.com/Mfmsport.ma", Icon: FacebookIcon },
  instagram: { name: "Instagram", href: "https://instagram.com/mfmsportofficiel", Icon: InstagramIcon },
  x: { name: "X", href: "https://x.com/MfmSport", Icon: XIcon },
  youtube: { name: "YouTube", href: "https://youtube.com/@mfmsport1430", Icon: YoutubeIcon },
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
