import { CalendarDays, Dumbbell, GitFork, House, type LucideIcon } from "lucide-react";
import type { FileRouteTypes } from "@/routeTree.gen";

export interface AppSection {
  to: FileRouteTypes["to"];
  /** Short label for the bottom navigation. */
  label: string;
  /** Screen title (heading, start-screen card). */
  title: string;
  description: string;
  icon: LucideIcon;
  /** data-track value of the start-screen card. */
  track: string;
}

/** The app's feature areas – shown as cards on the start screen. */
export const sections: readonly AppSection[] = [
  {
    to: "/tricks",
    label: "Tricks",
    title: "Trick-Tree",
    description: "Deine Progressions-Karte: Welche Tricks sitzen, welche kommen als Nächstes?",
    icon: GitFork,
    track: "start.tricks",
  },
  {
    to: "/sessions",
    label: "Sessions",
    title: "Sessions",
    description: "Jede Session festhalten – Spot, Dauer, Tricks und wie es sich angefühlt hat.",
    icon: CalendarDays,
    track: "start.sessions",
  },
  {
    to: "/training",
    label: "Training",
    title: "Training",
    description: "Kraft, Mobilität und Balance – dein Plan bis zum Contest.",
    icon: Dumbbell,
    track: "start.training",
  },
];

/** Bottom navigation: start plus all sections. */
export const navItems: readonly Pick<AppSection, "to" | "label" | "icon">[] = [
  { to: "/", label: "Start", icon: House },
  ...sections,
];

export function getSection(to: AppSection["to"]): AppSection {
  const section = sections.find((entry) => entry.to === to);
  if (section === undefined) {
    throw new Error(`Unknown section: ${to}`);
  }
  return section;
}
