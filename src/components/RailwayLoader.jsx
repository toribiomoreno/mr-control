import { useId } from 'react';
import './railway-motion.css';

// Ilustración decorativa: no demora la carga ni simula porcentajes de progreso.
export default function RailwayLoader({ label = 'Cargando…' }) {
  const id = useId().replaceAll(':', '');
  return <div className="railway-loader" role="status" aria-live="polite">
    <div className="railway-loader-scene" aria-hidden="true">
      <div className="railway-loader-scenery" />
      <div className="railway-loader-train">
        <svg viewBox="0 0 350 140" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <defs>
            <linearGradient id={`${id}-red`} x1="0" y1="25" x2="0" y2="100" gradientUnits="userSpaceOnUse"><stop stopColor="#ff655e" /><stop offset=".45" stopColor="#de333d" /><stop offset="1" stopColor="#a72235" /></linearGradient>
            <linearGradient id={`${id}-glass`} x1="255" y1="25" x2="280" y2="62" gradientUnits="userSpaceOnUse"><stop stopColor="#b6edf8" /><stop offset="1" stopColor="#315d76" /></linearGradient>
            <linearGradient id={`${id}-steel`} x1="0" y1="100" x2="0" y2="130" gradientUnits="userSpaceOnUse"><stop stopColor="#60758c" /><stop offset="1" stopColor="#202e42" /></linearGradient>
          </defs>
          <ellipse cx="179" cy="130" rx="153" ry="5" fill="#020a16" opacity=".5" />
          <path d="M21 93h300v10H21z" fill="#152234" stroke="#091322" strokeWidth="3" />
          <path d="M32 88V49q0-11 12-11h193V24q0-8 8-8h33q8 0 11 8l8 32h15q10 0 12 10l4 27H32Z" fill={`url(#${id}-red)`} stroke="#182334" strokeWidth="3" />
          <path d="M41 39h197V30l-25 1-11 7H41Z" fill="#ece5dc" />
          <path d="M240 17h39q7 0 10 8h-49Z" fill="#f4e9df" stroke="#273447" strokeWidth="2" />
          <path d="M250 29h14v29h-14Zm21 0h10l7 29h-17Z" fill={`url(#${id}-glass)`} stroke="#152c42" strokeWidth="3" />
          <path d="m253 32 8 8m13-8 9 11" stroke="#d9f6ff" strokeWidth="2" opacity=".75" />
          <path d="M72 39v-9q0-3 3-3h11q3 0 3 3v9" fill="#334052" stroke="#172234" strokeWidth="2" />
          <path d="M54 45h30v31H54Zm39 0h30v31H93Zm93 0h28v31h-28Z" fill="#872b37" stroke="#f37872" strokeWidth="1.5" />
          {[49,55,61,67,73].map(y => <path key={y} d={`M59 ${y}h20m19 0h20m72 0h17`} stroke="#182c3e" strokeWidth="2.5" />)}
          <path d="M132 43v38m43-38v38m49-38v44m18-25v31" stroke="#872834" strokeWidth="1.5" />
          <path d="M24 88h290v6H24z" fill="#f6cd56" stroke="#b88529" strokeWidth="1" />
          <path d="M295 69h26l5 23h-31Z" fill="#f2eee4" stroke="#26364b" strokeWidth="2" />
          <path d="m297 69 15 23m-4-23 15 23m-17-23 15 23" stroke="#dc3541" strokeWidth="5" />
          <path d="M312 60h8q3 0 3 3v4h-11Z" fill="#fff1b3" stroke="#20344a" strokeWidth="2" />
          <path className="railway-loader-headlight" fill="#ffe9a3" opacity=".12" d="m323 61 27-11v32l-27-16Z" />
          <path d="M36 66v27m196-27v27m4-27H35" stroke="#b9c6cc" strokeWidth="2" />
          <path d="M274 67v23m0-23h19v23" stroke="#bcc9cb" strokeWidth="2" />
          <path d="M118 103h113l-7 16h-100Z" fill="#27384a" stroke="#111e30" strokeWidth="2" />
          {[48,239].map(x => <g key={x}>
            {[x+11,x+31,x+51].map(cx => <g key={cx} className="railway-loader-wheel" style={{ transformOrigin:`${cx}px 120px` }}><circle cx={cx} cy="120" r="10" fill="#101b2c" stroke="#0c1522" strokeWidth="2" /><circle cx={cx} cy="120" r="6" fill="#67798a" /><path d={`M${cx-4} 120h8M${cx} 116v8`} stroke="#b1bfcb" strokeWidth="1.5" /></g>)}
            <path d={`M${x} 106q3-6 9-6h43q6 0 9 6l-5 12h-51Z`} fill={`url(#${id}-steel)`} stroke="#152338" strokeWidth="2" />
            <path d={`M${x+8} 106h45m-36-3v10m27-10v10`} stroke="#a3b1be" strokeWidth="2" /><path d={`M${x+21} 112h20`} stroke="#172638" strokeWidth="4" />
          </g>)}
          <path d="M319 100h16v7h-16" fill="#3a4c60" stroke="#172638" strokeWidth="2" />
          <path d="M137 50h20l-4 5h-16Zm0 8h15l-4 4h-11Zm0 8h10l-4 4h-6Z" fill="#fff1e8" />
          <text x="159" y="72" fill="#fff9ee" fontFamily="Arial, sans-serif" fontWeight="700" fontStyle="italic" fontSize="13">Ferrovías</text>
          <text x="253" y="82" fill="#fff4dd" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="10">E710</text>
        </svg>
      </div>
      <div className="railway-loader-track" />
    </div>
    <span className="railway-loader-label">{label}<span className="railway-loader-signal" aria-hidden="true" /></span>
  </div>;
}
