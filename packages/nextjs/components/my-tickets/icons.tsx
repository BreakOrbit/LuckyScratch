import type { ComponentProps, ComponentType } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CubeTransparentIcon,
  EyeIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  ScissorsIcon,
  SparklesIcon as SparklesOutlineIcon,
  Squares2X2Icon,
  StarIcon,
  SunIcon,
} from "@heroicons/react/24/outline";
import { BanknotesIcon, ClockIcon, SparklesIcon, TicketIcon } from "@heroicons/react/24/solid";

type HeroIcon = ComponentType<ComponentProps<"svg">>;

export type MyTicketsIconName =
  | "payments"
  | "pending"
  | "confirmation_number"
  | "search"
  | "content_cut"
  | "layers"
  | "auto_awesome"
  | "visibility"
  | "lock"
  | "chevron_left"
  | "chevron_right"
  | "diamond"
  | "stars"
  | "light"
  | "star";

export type PoolIconName = Extract<MyTicketsIconName, "diamond" | "stars" | "auto_awesome" | "light" | "star">;

const ICON_MAP: Record<MyTicketsIconName, HeroIcon> = {
  payments: BanknotesIcon,
  pending: ClockIcon,
  confirmation_number: TicketIcon,
  search: MagnifyingGlassIcon,
  content_cut: ScissorsIcon,
  layers: Squares2X2Icon,
  auto_awesome: SparklesIcon,
  visibility: EyeIcon,
  lock: LockClosedIcon,
  chevron_left: ChevronLeftIcon,
  chevron_right: ChevronRightIcon,
  diamond: SparklesOutlineIcon,
  stars: CubeTransparentIcon,
  light: SunIcon,
  star: StarIcon,
};

type MyTicketsIconProps = {
  name: MyTicketsIconName;
  className?: string;
};

export const MyTicketsIcon = ({ name, className }: MyTicketsIconProps) => {
  const Icon = ICON_MAP[name];
  return <Icon aria-hidden="true" className={className} />;
};
