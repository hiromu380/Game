import { greedyBot } from './greedy';
import { midBot } from './mid';
import { randomBot } from './random';
import { searchBot } from './search';
import type { Bot, BotName } from './types';

export const BOTS: Record<BotName, Bot> = {
  random: randomBot,
  greedy: greedyBot,
  mid: midBot,
  search: searchBot,
};

export type { Bot, BotName, BotOptions, ShiftPlan } from './types';
