import type { SVGProps } from "react";
import type { LucideIcon } from "lucide-react";
import type { MedForm, ProfileIcon as ProfileIconId } from "@/lib/meditrack/types";
import { Baby, Beaker, Droplets, Flower2, Heart, Pill, Smile, SprayCan, Syringe, Tablets, User, Users } from "lucide-react";

type IconProps = SVGProps<SVGSVGElement>;

const profiles: Record<ProfileIconId, LucideIcon> = {
  user: User,
  heart: Heart,
  baby: Baby,
  flower: Flower2,
  smile: Smile,
  users: Users,
};

export function ProfileGlyph({ icon, ...props }: { icon: ProfileIconId } & IconProps) {
  const Cmp = profiles[icon];
  return <Cmp aria-hidden {...props} />;
}

const forms: Record<MedForm, LucideIcon> = {
  tablet: Tablets,
  capsule: Pill,
  drops: Droplets,
  injection: Syringe,
  spray: SprayCan,
  ointment: Beaker,
  powder: Beaker,
  other: Pill,
};

export function FormGlyph({ form, ...props }: { form: MedForm } & IconProps) {
  const Cmp = forms[form];
  return <Cmp aria-hidden {...props} />;
}