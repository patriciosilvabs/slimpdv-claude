// Badge color utilities for KDS
// Maps color names to Tailwind CSS classes (cannot use string interpolation with Tailwind)

export type BadgeColorName = 'amber' | 'orange' | 'yellow' | 'red' | 'pink' | 'purple' | 'blue' | 'cyan' | 'green' | 'lime';

export interface BadgeColorClasses {
  bg: string;
  text: string;
}

export const BADGE_COLOR_OPTIONS: Array<{ value: BadgeColorName; label: string; bgClass: string }> = [
  { value: 'amber', label: 'Âmbar', bgClass: 'bg-amber-500' },
  { value: 'orange', label: 'Laranja', bgClass: 'bg-orange-500' },
  { value: 'yellow', label: 'Amarelo', bgClass: 'bg-yellow-500' },
  { value: 'red', label: 'Vermelho', bgClass: 'bg-red-500' },
  { value: 'pink', label: 'Rosa', bgClass: 'bg-pink-500' },
  { value: 'purple', label: 'Roxo', bgClass: 'bg-purple-500' },
  { value: 'blue', label: 'Azul', bgClass: 'bg-blue-500' },
  { value: 'cyan', label: 'Ciano', bgClass: 'bg-cyan-500' },
  { value: 'green', label: 'Verde', bgClass: 'bg-green-500' },
  { value: 'lime', label: 'Verde Limão', bgClass: 'bg-lime-500' },
];

const colorMap: Record<BadgeColorName, BadgeColorClasses> = {
  amber:  { bg: 'bg-amber-500',  text: 'text-amber-950'  },
  orange: { bg: 'bg-orange-500', text: 'text-orange-950' },
  yellow: { bg: 'bg-yellow-500', text: 'text-yellow-950' },
  red:    { bg: 'bg-red-500',    text: 'text-red-950'    },
  pink:   { bg: 'bg-pink-500',   text: 'text-pink-950'   },
  purple: { bg: 'bg-purple-500', text: 'text-purple-950' },
  blue:   { bg: 'bg-blue-500',   text: 'text-blue-950'   },
  cyan:   { bg: 'bg-cyan-500',   text: 'text-cyan-950'   },
  green:  { bg: 'bg-green-500',  text: 'text-green-950'  },
  lime:   { bg: 'bg-lime-500',   text: 'text-lime-950'   },
};

export function getBadgeColorClasses(color: string): BadgeColorClasses {
  return colorMap[color as BadgeColorName] || colorMap.amber;
}
