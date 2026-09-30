import './railway-motion.css';

// Decorative animation only: never delays a request or invents progress.
export default function RailwayLoader({ label = 'Cargando…' }) {
  return <div className="railway-loader" role="status" aria-live="polite">
    <div className="railway-loader-scene" aria-hidden="true">
      <div className="railway-loader-scenery" />
      <div className="railway-loader-train">
        <svg viewBox="0 0 256 96" fill="none" shapeRendering="crispEdges">
          <path fill="#111b2b" d="M8 68h237v13H8z" />
          <path fill="#ee313b" d="M15 38h148V16h45v22h27v30H15z" />
          <path fill="#a51d2b" d="M15 54h148v14H15zM208 38h27v30h-27z" />
          <path fill="#fa5259" d="M15 35h148v5H15zM159 12h53v5h-53z" />
          <path fill="#182b3c" d="M171 21h13v19h-13zM189 21h13v19h-13z" />
          <path fill="#8bd0e3" d="M172 22h10v3h-10zM190 22h10v3h-10z" />
          <path fill="#151f29" d="M28 42h25v12H28zM61 42h25v12H61zM95 42h25v12H95zM43 29h13v6H43z" />
          <path stroke="#667080" strokeWidth="2" d="M32 45h17m-17 5h17m16-5h17m-17 5h17m17-5h17m-17 5h17" />
          <path fill="#f7cd45" d="M10 65h230v4H10zM10 55h3v14h-3zM238 51h3v18h-3z" />
          <path fill="#f2f1e9" d="M218 57h6v11h-6zM229 57h6v11h-6z" />
          <path fill="#27374a" d="M30 76h53v12H30zM171 76h53v12h-53z" />
          {[40, 70, 182, 212].map(x => <g key={x} className="railway-loader-wheel" style={{ transformOrigin: `${x}px 84px` }}><circle cx={x} cy="84" r="9" fill="#0a111c" /><circle cx={x} cy="84" r="6" stroke="#8592a0" strokeWidth="2" /><path d={`M${x - 5} 84h10M${x} 79v10`} stroke="#b7c4cc" strokeWidth="2" /></g>)}
          <path fill="#e9f5ff" d="M235 43h6v7h-6z" />
          <path className="railway-loader-headlight" fill="#ffe9a3" opacity=".14" d="m241 42 15-7v24l-15-9z" />
          <text x="30" y="64" fill="white" fontFamily="Arial, sans-serif" fontWeight="700" fontStyle="italic" fontSize="9">Ferrovías</text>
          <text x="171" y="58" fill="white" fontFamily="monospace" fontWeight="700" fontSize="9">E714</text>
        </svg>
      </div>
      <div className="railway-loader-track" />
    </div>
    <span className="railway-loader-label">{label}<span className="railway-loader-signal" aria-hidden="true" /></span>
  </div>;
}
