/** Deterministic per-title gradient + initials for the offline "poster". */
function hashString(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

export function posterGradient(title) {
  const h = hashString(String(title));
  const hue = h % 360;
  const hue2 = (hue + 40 + (h % 60)) % 360;
  return {
    backgroundImage: `linear-gradient(155deg, hsl(${hue} 65% 30%) 0%, hsl(${hue2} 70% 16%) 60%, hsl(${hue2} 60% 10%) 100%)`,
  };
}

export function initialsOf(title) {
  return String(title)
    .split(/\s+/)
    .filter((w) => /[a-z0-9]/i.test(w) && !["the", "a", "an", "of", "and"].includes(w.toLowerCase()))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export default function Poster({ title, year, className = "" }) {
  return (
    <div
      className={`poster-art relative flex aspect-[2/3] items-end rounded-xl ${className}`}
      style={posterGradient(title)}
      aria-hidden="true"
    >
      <div className="relative z-10 flex h-[55%] w-full items-center justify-center">
        <span className="select-none px-2 text-center text-4xl font-black leading-none tracking-tight text-white/90 drop-shadow md:text-5xl">
          {initialsOf(title)}
        </span>
      </div>
      <div className="relative z-10 w-full translate-y-[-56%] px-2 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">{year || "—"}</p>
      </div>
    </div>
  );
}
