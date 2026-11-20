/**
 * Penny (a piggy bank) and Patch (a bandage), the two original hosts.
 * Ported from prototype/index.html. Pure SVG <g> groups centered at (0,0) so they can be
 * placed with a transform in any SVG: the app UI and the Remotion composition both use these.
 * `mouthOpen` (0–1) and `eyesClosed` let the video animate talking and blinking.
 */
const INK = "#3b2a4a";

type Props = { mouthOpen?: number; eyesClosed?: boolean };

const Eye = ({ cx, cy, r, px, pr, closed }: { cx: number; cy: number; r: number; px: number; pr: number; closed?: boolean }) =>
  closed ? (
    <path d={`M${cx - r} ${cy} q${r} ${r * 0.6} ${2 * r} 0`} fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
  ) : (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#fff" stroke={INK} strokeWidth={3} />
      <circle cx={cx + px} cy={cy + 1} r={pr} fill="#1d2340" />
    </g>
  );

export function Penny({ mouthOpen = 0.3, eyesClosed }: Props) {
  return (
    <g>
      <rect x={-52} y={40} width={20} height={30} rx={8} fill="#f48fb5" stroke={INK} strokeWidth={4} />
      <rect x={28} y={40} width={20} height={30} rx={8} fill="#f48fb5" stroke={INK} strokeWidth={4} />
      <path d="M-80 0 q-26 -6 -22 -26" fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <path d="M-50 -46 L-38 -86 L-16 -58 Z" fill="#f48fb5" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      <path d="M14 -58 L34 -88 L44 -48 Z" fill="#f48fb5" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      <ellipse cx={0} cy={0} rx={82} ry={64} fill="#f7a8c4" stroke={INK} strokeWidth={4} />
      <rect x={-20} y={-66} width={40} height={8} rx={4} fill={INK} />
      <circle cx={-30} cy={-10} r={9} fill="#ff7fa8" opacity={0.55} />
      <ellipse cx={62} cy={4} rx={24} ry={18} fill="#f48fb5" stroke={INK} strokeWidth={4} />
      <circle cx={55} cy={3} r={4} fill={INK} />
      <circle cx={69} cy={3} r={4} fill={INK} />
      <Eye cx={6} cy={-20} r={11} px={3} pr={5} closed={eyesClosed} />
      <Eye cx={34} cy={-22} r={11} px={3} pr={5} closed={eyesClosed} />
      <ellipse cx={28} cy={30} rx={12} ry={2 + 10 * mouthOpen} fill="#7a1f45" stroke={INK} strokeWidth={3} />
    </g>
  );
}

const PATCH_DOTS: [number, number][] = [[-18, 4], [0, 4], [18, 4], [-18, 22], [0, 22], [18, 22], [-9, 38], [9, 38]];

export function Patch({ mouthOpen = 0.3, eyesClosed }: Props) {
  return (
    <g>
      <ellipse cx={-24} cy={100} rx={22} ry={10} fill={INK} />
      <ellipse cx={24} cy={100} rx={22} ry={10} fill={INK} />
      <path d="M-44 0 q-30 10 -34 -24" fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" />
      <path d="M44 0 q32 6 36 -30" fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" />
      <rect x={-46} y={-100} width={92} height={196} rx={44} fill="#f2c48d" stroke={INK} strokeWidth={4} />
      <rect x={-36} y={-14} width={72} height={62} rx={12} fill="#fbe3c4" stroke="#d9a768" strokeWidth={3} />
      {PATCH_DOTS.map(([x, y]) => (
        <circle key={`${x},${y}`} cx={x} cy={y} r={2.6} fill="#d9a768" />
      ))}
      {[[-30, -80], [30, -80], [-30, 80], [30, 80]].map(([x, y]) => (
        <circle key={`c${x},${y}`} cx={x} cy={y} r={2.6} fill="#d9a768" />
      ))}
      <Eye cx={-15} cy={-62} r={10} px={2} pr={4.5} closed={eyesClosed} />
      <Eye cx={15} cy={-62} r={10} px={2} pr={4.5} closed={eyesClosed} />
      <circle cx={-26} cy={-40} r={6} fill="#ff9d7a" opacity={0.55} />
      <circle cx={26} cy={-40} r={6} fill="#ff9d7a" opacity={0.55} />
      <ellipse cx={0} cy={-36} rx={11} ry={2 + 10 * mouthOpen} fill="#7a2d12" stroke={INK} strokeWidth={3} />
    </g>
  );
}

/** Small decorative pair for page headers (hidden from screen readers). */
export function MiniHosts({ width = 220 }: { width?: number }) {
  return (
    <svg viewBox="0 0 360 230" width={width} aria-hidden="true" focusable="false">
      <ellipse cx={180} cy={214} rx={170} ry={14} fill="#dfe9fb" />
      <g transform="translate(110 140) scale(.8)">
        <Penny />
      </g>
      <g transform="translate(270 112) scale(.72)">
        <Patch />
      </g>
    </svg>
  );
}
