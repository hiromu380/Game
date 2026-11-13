/**
 * 中継タワー（配置系）: 受けた信号を自身の向きへ、隣のマスを飛び越えて送る（relayJump マス飛び越す。既定は2マス先に届く）
 *
 * 飛び越えたマスのパーツ・床・使用不可には触れないので、使用不可マスや別の経路をまたげる。
 * 届いた先が盤面外・空マスなら、ふつうの信号と同じく消える。
 */
import { dir4ToDir8 } from '../../core/direction';
import type { PartBehavior } from './types';

export const relayBehavior: PartBehavior = {
  react: ({ part, value, rules }) => ({
    emits: [{ dir: dir4ToDir8(part.dir), value, jump: rules.params.relayJump }],
  }),
};
