import { greedyBot } from './greedy';
import { randomBot } from './random';
import { searchBot } from './search';
import type { Bot, BotName } from './types';

export const BOTS: Record<BotName, Bot> = {
  random: randomBot,
  greedy: greedyBot,
  search: searchBot,
};

export type { Bot, BotName, BotOptions, ShiftPlan } from './types';
