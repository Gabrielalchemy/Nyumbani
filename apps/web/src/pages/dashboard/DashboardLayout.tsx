import { NavLink, Outlet, Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BarChart3, Boxes, ClipboardList, Hammer, LogOut } from "lucide-react";
import { getToken } from "../../lib/api";

const links = [
  { to: "/dashboard", label: "Overview", icon: BarChart3, end: true },
  { to: "/dashboard/products", label: "Products & stock", icon: Boxes },
  { to: "/dashboard/orders", label: "Orders", icon: ClipboardList },
  { to: "/dashboard/insights", label: "AI insights", icon: Hammer },
];

export default function DashboardLayout() {
  const navigate = useNavigate();

  if (!getToken()) return <Navigate to="/dashboard/login" replace />;

  return (
    <div className="flex min-h-screen bg-sand-100">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-ink px-4 py-6 md:flex">
        <a href="/" className="mb-8 flex items-center gap-2.5 px-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-clay-700 text-paper">
            <Hammer size={17} />
          </span>
          <span className="font-display text-lg font-semibold text-paper">Nyumbani</span>
        </a>
        <nav className="flex-1 space-y-1">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? "bg-white/10 text-paper" : "text-paper/60 hover:bg-white/5 hover:text-paper"
                }`
              }
            >
              <Icon size={17} /> {label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() => {
            localStorage.removeItem("nyumbani_token");
            navigate("/dashboard/login");
          }}
          className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-paper/60 transition hover:bg-white/5 hover:text-paper"
        >
          <LogOut size={17} /> Sign out
        </button>
      </aside>

      {/* Mobile topbar */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center gap-3 overflow-x-auto bg-ink px-4 py-3 md:hidden">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-clay-700 text-paper">
          <Hammer size={15} />
        </span>
        {links.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                isActive ? "bg-white/15 text-paper" : "text-paper/60"
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </div>

      <main className="flex-1 px-4 pt-20 pb-12 sm:px-8 md:ml-60 md:pt-10">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-5xl"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
