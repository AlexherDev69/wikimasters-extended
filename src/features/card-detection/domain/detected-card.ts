import type { Rarity } from './rarity';

export interface DetectedCard {
  title: string;
  description: string | null;
  rarity: Rarity;
}
