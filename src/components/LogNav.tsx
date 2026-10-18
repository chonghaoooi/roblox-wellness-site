const sections = [
  { id: "meal", label: "Meal", icon: "🍽️", color: "green" },
  { id: "steps", label: "Steps", icon: "👟", color: "blue" },
  { id: "gym", label: "Gym", icon: "🏋️", color: "purple" },
  { id: "weigh-in", label: "Weigh-in", icon: "⚖️", color: "purple" },
  { id: "log-history", label: "Recent logs", icon: "📋", color: "yellow" },
] as const;

export function LogNav() {
  return (
    <nav aria-label="Log navigation" className="log-quick-nav panel !sticky top-[6.5rem] z-30 self-start !rounded-xl !bg-[#11131b] p-2 shadow-lg sm:top-44 lg:top-32 lg:p-3">
      <h2 className="rb-text mb-3 hidden px-1 text-xl lg:block">QUICK LOG</h2>
      <ul className="grid grid-cols-3 gap-2 lg:grid-cols-1 lg:gap-3">
        {sections.map(({ id, label, icon, color }) => (
          <li key={id} className="min-w-0">
            <a href={`#${id}`} className={`btn btn-${color} w-full !gap-1.5 !px-1 !text-sm lg:!justify-start lg:!gap-2 lg:!px-3 lg:!text-base`}>
              <span aria-hidden="true">{icon}</span><span>{label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
