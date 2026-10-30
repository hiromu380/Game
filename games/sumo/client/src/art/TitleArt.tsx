/** 木版画の色面で描く稽古場。同じ3D肖像を重ね、SVGへの復旧も保つ。 */
import { ThreePortrait } from './ThreePortrait';
import { oyakataLook, rikishiLook } from './look';
import { PALETTE as P } from './palette';
import { Mon } from './Mon';

export function TitleArt({ title }: { title: string }) {
  const left = rikishiLook({
    id: 11,
    weight: 150,
    stableId: 3,
    careerBasho: 40,
    sekitori: true,
    yokozuna: false,
    injured: false,
    fatigue: 0,
  });
  const right = rikishiLook({
    id: 23,
    weight: 110,
    stableId: 3,
    careerBasho: 2,
    sekitori: false,
    yokozuna: false,
    injured: false,
    fatigue: 0,
  });
  const master = oyakataLook({ id: 5, age: 48, stableId: 1 });
  return (
    <div className="title-art title-art--scene" role="img" aria-label={title}>
      <svg viewBox="0 0 420 300" className="title-art__background" aria-hidden="true">
        <rect width={420} height={300} fill={P.washi2} />
        {/* 窓の向こうの山並み。色を絞って、稽古場の静けさを残す。 */}
        <path d="M34 59 H386 V204 H34Z" fill={P.aiLight} />
        <circle cx={323} cy={95} r={24} fill={P.card} />
        <path
          d="M34 165 L88 115 L116 134 L157 107 L220 163 L274 130 L340 162 L386 137 V208 H34Z"
          fill={P.line}
        />
        <path
          d="M34 180 Q98 136 155 166 Q202 137 254 172 Q321 139 386 178 V213 H34Z"
          fill={P.wakatake}
        />
        <path d="M34 195 Q133 170 223 193 Q315 170 386 196 V216 H34Z" fill={P.ai} />
        {/* 柱・鴨居・手前の縁側。板目を数本だけ入れ、写真の質感に寄せない。 */}
        <path
          d="M0 0 H420 V24 H0Z M10 20 H35 V225 H10Z M385 20 H410 V225 H385Z"
          fill={P.sumi2}
          stroke={P.sumi}
          strokeWidth={2}
        />
        <path d="M16 36 V210 M398 36 V210" stroke={P.odo} strokeWidth={1} />
        <path d="M35 25 H385 V37 H35Z" fill={P.odo} stroke={P.sumi} strokeWidth={1.5} />
        <path d="M0 221 H420 V300 H0Z" fill={P.odoLight} />
        <path d="M0 221 H420 M0 285 H420" stroke={P.sumi2} strokeWidth={2} />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <path
            key={i}
            d={`M${i * 70 - 13} 221 L${i * 85 - 55} 300`}
            stroke={P.odo}
            strokeWidth={1}
          />
        ))}
        <ellipse
          cx={210}
          cy={259}
          rx={161}
          ry={29}
          fill={P.washi2}
          stroke={P.odo}
          strokeWidth={3}
        />
        <ellipse cx={210} cy={259} rx={153} ry={25} fill={P.washi} />
        {/* 両脇の障子は開けて、景色と人物がひと続きの画面になるようにする。 */}
        {[36, 334].map((x) => (
          <g key={x}>
            <rect
              x={x}
              y={81}
              width={50}
              height={134}
              fill={P.card}
              stroke={P.sumi2}
              strokeWidth={2}
            />
            {[108, 135, 162, 189].map((y) => (
              <path key={y} d={`M${x} ${y} h50`} stroke={P.line} />
            ))}
            <path d={`M${x + 25} 81 V215`} stroke={P.line} />
          </g>
        ))}
        {/* 揃いすぎない暖簾の裾と、共通の架空の紋。 */}
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M${70 + i * 94} 38 h90 v48 q-45 ${i === 1 ? 5 : 1} -90 0Z`}
            fill={P.ai}
            stroke={P.sumi}
            strokeWidth={1.5}
          />
        ))}
        <Mon x={193} y={45} size={34} />
        <path d="M62 33 H358" stroke={P.sumi} strokeWidth={4} strokeLinecap="round" />
      </svg>
      <span className="title-art__figure title-art__figure--left">
        <ThreePortrait look={left} size="100%" variant="full" />
      </span>
      <span className="title-art__figure title-art__figure--master">
        <ThreePortrait look={master} size="100%" variant="full" />
      </span>
      <span className="title-art__figure title-art__figure--right">
        <ThreePortrait look={right} size="100%" variant="full" />
      </span>
    </div>
  );
}
