import React, { useState, useEffect } from 'react';
import { Link, useLocation, useSearchParams, Outlet } from 'react-router-dom';
import { getFinanceRole, FINANCE_TABS } from './finance/FinanceDashboard';
import {
  LayoutGrid,
  Tag,
  Utensils,
  Menu as MenuIcon,
  Users,
  Star,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  LogOut,
  Home,
  Settings,
  BarChart3,
  Receipt,
  Database,
  Image as ImageIcon,
  Briefcase,
  Newspaper,
  CalendarDays,
  Truck,
  Wallet,
  MoreHorizontal,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import PushToggle from './PushToggle';

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  to?: string;
  isActive?: boolean;
  hasSubmenu?: boolean;
  isOpen?: boolean;
  isCollapsed?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}

const SidebarItem: React.FC<SidebarItemProps> = ({
  icon,
  label,
  to,
  isActive,
  hasSubmenu,
  isOpen,
  isCollapsed,
  onClick,
  children
}) => {
  const content = (
    <div
      className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all cursor-pointer group ${
        isActive
          ? 'bg-terracotta text-white shadow-md'
          : 'text-gray-500 hover:bg-gray-100 hover:text-ink'
      } ${isCollapsed ? 'justify-center px-2' : ''}`}
      onClick={onClick}
      title={isCollapsed ? label : undefined}
    >
      <div className="flex items-center gap-3">
        <span className={`${isActive ? 'text-white' : 'text-gray-400 group-hover:text-terracotta'} transition-colors`}>
          {icon}
        </span>
        {!isCollapsed && <span className="font-medium whitespace-nowrap">{label}</span>}
      </div>
      {hasSubmenu && !isCollapsed && (
        <span>
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      )}
    </div>
  );

  return (
    <div className="mb-1">
      {to && !hasSubmenu ? (
        <Link to={to}>{content}</Link>
      ) : (
        content
      )}
      <AnimatePresence>
        {isOpen && children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden ml-4 mt-1 space-y-1"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SidebarSubItem: React.FC<{ label: string; to: string; isActive: boolean }> = ({ label, to, isActive }) => (
  <Link
    to={to}
    className={`block px-4 py-2 rounded-lg text-sm transition-all ${
      isActive
        ? 'text-terracotta font-bold bg-terracotta/5'
        : 'text-gray-400 hover:text-ink hover:bg-gray-50'
    }`}
  >
    {label}
  </Link>
);

// Installed-app (PWA) view: trimmed to the sections Shane checks on the go.
// Logging into the dashboard from a regular browser still shows the full menu.
const PWA_ALLOWED_FINANCE_TABS = ['overview', 'daily-balances', 'ledger', 'reports'];

export default function DashboardLayout({ user }: { user: any }) {
  const isPWA = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
  const isAdmin = user?.email?.toLowerCase() === 'info@cajunlifecafe.com' || user?.role === 'admin';
  const canSeeFinance = isAdmin || user?.role === 'manager' || user?.role === 'cashier';
  const financeRole = getFinanceRole(user);
  const financeTabs = FINANCE_TABS.filter(t => t.roles.includes(financeRole) && (!isPWA || PWA_ALLOWED_FINANCE_TABS.includes(t.id)));
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentFinanceTab = searchParams.get('tab') || financeTabs[0]?.id;
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [isFinanceOpen, setIsFinanceOpen] = useState(location.pathname.startsWith('/dashboard/finance'));
  const [isCollapsed, setIsCollapsed] = useState(isPWA);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const isActive = (path: string) => location.pathname === path;
  const isSubActive = (path: string) => location.pathname.startsWith(path);

  // ── Phone layout (< md): bottom tab bar + "More" sheet ────────────────────
  // Same role gating as the desktop sidebar below.
  const role = user?.role;
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  useEffect(() => { setIsMoreOpen(false); }, [location.pathname, location.search]);

  const onFinance = isActive('/dashboard/finance');
  const nonBalanceFinanceTabs = financeTabs.filter(t => t.id !== 'daily-balances');
  const bottomTabs = [
    canSeeFinance && financeTabs.some(t => t.id === 'daily-balances') && {
      key: 'balances', label: 'Balances', icon: <Wallet size={22} />,
      to: '/dashboard/finance?tab=daily-balances',
      active: onFinance && currentFinanceTab === 'daily-balances',
    },
    canSeeFinance && nonBalanceFinanceTabs.length > 0 && {
      key: 'finance', label: 'Finance', icon: <span className="text-[22px] font-bold leading-none">฿</span>,
      to: `/dashboard/finance?tab=${nonBalanceFinanceTabs[0].id}`,
      active: onFinance && currentFinanceTab !== 'daily-balances',
    },
    (role === 'admin' || role === 'marketing') && {
      key: 'food', label: 'Food Costs', icon: <Utensils size={22} />,
      to: '/dashboard/food-costs', active: isActive('/dashboard/food-costs'),
    },
    (role === 'admin' || role === 'cashier') && {
      key: 'loyalty', label: 'Loyalty', icon: <Star size={22} />,
      to: '/dashboard/loyalty', active: isActive('/dashboard/loyalty'),
    },
  ].filter(Boolean) as { key: string; label: string; icon: React.ReactNode; to: string; active: boolean }[];

  const moreItems = [
    { label: 'Deliveries', icon: <Truck size={20} />, to: '/dashboard/deliveries', show: role === 'admin' || role === 'manager' || role === 'cashier' },
    { label: 'Main Menu', icon: <LayoutGrid size={20} />, to: '/dashboard', show: !isPWA && (role === 'admin' || role === 'marketing') },
    { label: 'Categories', icon: <Tag size={20} />, to: '/dashboard/categories', show: !isPWA && (role === 'admin' || role === 'marketing') },
    { label: 'Custom Meals', icon: <MenuIcon size={20} />, to: '/dashboard/custom-meals', show: !isPWA && (role === 'admin' || role === 'marketing') },
    { label: 'Job Postings', icon: <Briefcase size={20} />, to: '/dashboard/jobs', show: !isPWA && (role === 'admin' || role === 'manager') },
    { label: 'Calendar', icon: <CalendarDays size={20} />, to: '/dashboard/calendar', show: !isPWA && ['admin', 'manager', 'cashier', 'marketing'].includes(role) },
    { label: 'CRM', icon: <Users size={20} />, to: '/dashboard/crm', show: !isPWA && role === 'admin' },
    { label: 'Users', icon: <Users size={20} />, to: '/dashboard/users', show: !isPWA && role === 'admin' },
    { label: 'Images', icon: <ImageIcon size={20} />, to: '/dashboard/images', show: !isPWA && (role === 'admin' || role === 'marketing') },
    { label: 'Blog', icon: <Newspaper size={20} />, to: '/dashboard/blog', show: !isPWA && (role === 'admin' || role === 'marketing') },
    { label: 'System Logs', icon: <Database size={20} />, to: '/dashboard/logs', show: !isPWA && role === 'admin' },
    { label: 'Staff Portal', icon: <Receipt size={20} />, to: '/cashier', show: role === 'admin' || role === 'cashier' || role === 'marketing' },
    { label: 'Back to Site', icon: <Home size={20} />, to: '/', show: true },
  ].filter(i => i.show);
  const moreActive = moreItems.some(i => i.to !== '/' && isActive(i.to));

  return (
    <div className="flex min-h-screen bg-cream">
      {/* Sidebar (tablet/desktop) */}
      <aside className={`${isCollapsed ? 'w-20' : 'w-64'} bg-white border-r border-gray-100 hidden md:flex flex-col fixed h-screen z-20 transition-all duration-300 ease-in-out`}>
        <div className={`p-6 mb-4 flex items-center justify-between ${isCollapsed ? 'px-4' : ''}`}>
          <Link to="/" className="flex items-center gap-3 group overflow-hidden">
            <div className="w-10 h-10 bg-terracotta rounded-xl flex-shrink-0 flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
              <span className="text-white font-display font-bold text-xl">C</span>
            </div>
            {!isCollapsed && <span className="font-display font-bold text-xl text-ink tracking-tight whitespace-nowrap">Cajun Life</span>}
          </Link>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors ${isCollapsed ? 'hidden' : ''}`}
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        {isCollapsed && (
          <div className="flex justify-center mb-6">
            <button
              onClick={() => setIsCollapsed(false)}
              className="p-2 rounded-xl bg-gray-50 text-terracotta hover:bg-terracotta hover:text-white transition-all shadow-sm"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}

        <nav className="flex-1 px-4 overflow-y-auto scrollbar-hide">
          {!isCollapsed && (
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4 px-4">
              Main Navigation
            </div>
          )}

          {(user?.role === 'admin' || user?.role === 'marketing') && (
            isPWA ? (
              <SidebarItem
                icon={<Utensils size={20} />}
                label="Food Costs"
                to="/dashboard/food-costs"
                isCollapsed={isCollapsed}
                isActive={isActive('/dashboard/food-costs')}
              />
            ) : (
              <SidebarItem
                icon={<LayoutGrid size={20} />}
                label="Menu"
                hasSubmenu
                isOpen={isMenuOpen}
                isCollapsed={isCollapsed}
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                isActive={isSubActive('/dashboard/menu') || isActive('/dashboard') || isActive('/dashboard/categories') || isActive('/dashboard/custom-meals') || isActive('/dashboard/food-costs')}
              >
                {!isCollapsed && (
                  <>
                    <SidebarSubItem
                      label="Main Menu"
                      to="/dashboard"
                      isActive={isActive('/dashboard')}
                    />
                    <SidebarSubItem
                      label="Categories"
                      to="/dashboard/categories"
                      isActive={isActive('/dashboard/categories')}
                    />
                    <SidebarSubItem
                      label="Custom Meals"
                      to="/dashboard/custom-meals"
                      isActive={isActive('/dashboard/custom-meals')}
                    />
                    <SidebarSubItem
                      label="Food Costs"
                      to="/dashboard/food-costs"
                      isActive={isActive('/dashboard/food-costs')}
                    />
                  </>
                )}
              </SidebarItem>
            )
          )}

          {canSeeFinance && (
            <SidebarItem
              icon={<span className="text-[20px] font-bold leading-none">฿</span>}
              label="Finance"
              hasSubmenu
              isOpen={isFinanceOpen}
              isCollapsed={isCollapsed}
              onClick={() => setIsFinanceOpen(!isFinanceOpen)}
              isActive={isSubActive('/dashboard/finance')}
            >
              {!isCollapsed && financeTabs.map(tab => (
                <SidebarSubItem
                  key={tab.id}
                  label={tab.label}
                  to={`/dashboard/finance?tab=${tab.id}`}
                  isActive={isActive('/dashboard/finance') && currentFinanceTab === tab.id}
                />
              ))}
            </SidebarItem>
          )}

          {(user?.role === 'admin' || user?.role === 'cashier') && (
            <SidebarItem
              icon={<Star size={20} />}
              label="Loyalty & Payments"
              to="/dashboard/loyalty"
              isCollapsed={isCollapsed}
              isActive={isActive('/dashboard/loyalty')}
            />
          )}

          {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'cashier') && (
            <SidebarItem
              icon={<Truck size={20} />}
              label="Deliveries"
              to="/dashboard/deliveries"
              isCollapsed={isCollapsed}
              isActive={isActive('/dashboard/deliveries')}
            />
          )}

          {!isPWA && (user?.role === 'admin' || user?.role === 'manager') && (
            <SidebarItem
              icon={<Briefcase size={20} />}
              label="Job Postings"
              to="/dashboard/jobs"
              isCollapsed={isCollapsed}
              isActive={isActive('/dashboard/jobs')}
            />
          )}

          {!isPWA && (user?.role === 'admin' || user?.role === 'manager' || user?.role === 'cashier' || user?.role === 'marketing') && (
            <SidebarItem
              icon={<CalendarDays size={20} />}
              label="Calendar"
              to="/dashboard/calendar"
              isCollapsed={isCollapsed}
              isActive={isActive('/dashboard/calendar')}
            />
          )}

          {!isPWA && user?.role === 'admin' && (
            <SidebarItem
              icon={<Users size={20} />}
              label="CRM & Directory"
              to="/dashboard/crm"
              isCollapsed={isCollapsed}
              isActive={isActive('/dashboard/crm')}
            />
          )}

          {!isPWA && user?.role === 'admin' && (
            <SidebarItem
              icon={<Users size={20} />}
              label="Users"
              to="/dashboard/users"
              isCollapsed={isCollapsed}
              isActive={isActive('/dashboard/users')}
            />
          )}

          {!isPWA && (user?.role === 'admin' || user?.role === 'marketing') && (
            <SidebarItem
              icon={<ImageIcon size={20} />}
              label="Image Management"
              to="/dashboard/images"
              isCollapsed={isCollapsed}
              isActive={isActive('/dashboard/images')}
            />
          )}

          {!isPWA && (user?.role === 'admin' || user?.role === 'marketing') && (
            <SidebarItem
              icon={<Newspaper size={20} />}
              label="Blog"
              to="/dashboard/blog"
              isCollapsed={isCollapsed}
              isActive={isActive('/dashboard/blog')}
            />
          )}

          {!isPWA && user?.role === 'admin' && (
            <SidebarItem
              icon={<Database size={20} />}
              label="System Logs"
              to="/dashboard/logs"
              isCollapsed={isCollapsed}
              isActive={isActive('/dashboard/logs')}
            />
          )}

          <div className={`mt-8 pt-8 border-t border-gray-50 ${isCollapsed ? 'px-0' : ''}`}>
            {!isCollapsed && (
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4 px-4">
                System
              </div>
            )}
            <SidebarItem
              icon={<Home size={20} />}
              label="Back to Site"
              to="/"
              isCollapsed={isCollapsed}
            />
            {(user?.role === 'admin' || user?.role === 'cashier' || user?.role === 'marketing') && (
              <SidebarItem
                icon={<Receipt size={20} />}
                label="Staff Portal"
                to="/cashier"
                isCollapsed={isCollapsed}
              />
            )}
            <button
              onClick={handleSignOut}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all group ${isCollapsed ? 'justify-center px-2' : ''}`}
              title={isCollapsed ? "Sign Out" : undefined}
            >
              <LogOut size={20} className="text-gray-400 group-hover:text-red-500" />
              {!isCollapsed && <span className="font-medium">Sign Out</span>}
            </button>
          </div>
        </nav>

        <div className={`p-4 bg-gray-50 m-4 rounded-2xl transition-all ${isCollapsed ? 'm-2 p-2' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-terracotta/10 flex-shrink-0 flex items-center justify-center text-terracotta font-bold text-xs">
              {user?.displayName?.[0] || user?.email?.[0].toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-ink truncate">{user?.displayName || user?.email}</p>
                <p className="text-[10px] text-gray-400 capitalize">{user?.role || 'Administrator'}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 min-w-0 ${isCollapsed ? 'md:ml-20' : 'md:ml-64'} min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0 transition-all duration-300 ease-in-out`}>
        {/* Phone: Finance sub-tabs (the desktop sidebar submenu handles this on md+) */}
        {onFinance && currentFinanceTab !== 'daily-balances' && nonBalanceFinanceTabs.length > 1 && (
          <div className="md:hidden sticky top-0 z-10 bg-cream/95 backdrop-blur border-b border-gray-100 px-4 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
            {nonBalanceFinanceTabs.map(tab => (
              <Link
                key={tab.id}
                to={`/dashboard/finance?tab=${tab.id}`}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  currentFinanceTab === tab.id ? 'bg-terracotta text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        )}
        <Outlet />
      </main>

      {/* Bottom tab bar (phones) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-gray-100 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch justify-around px-2">
          {bottomTabs.map(tab => (
            <Link
              key={tab.key}
              to={tab.to}
              className={`flex-1 flex flex-col items-center justify-center gap-1 pt-2.5 pb-2 min-h-[60px] transition-colors ${
                tab.active ? 'text-terracotta' : 'text-gray-400'
              }`}
            >
              {tab.icon}
              <span className={`text-[11px] ${tab.active ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
            </Link>
          ))}
          <button
            onClick={() => setIsMoreOpen(true)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 pt-2.5 pb-2 min-h-[60px] transition-colors ${
              moreActive || isMoreOpen ? 'text-terracotta' : 'text-gray-400'
            }`}
          >
            <MoreHorizontal size={22} />
            <span className={`text-[11px] ${moreActive ? 'font-bold' : 'font-medium'}`}>More</span>
          </button>
        </div>
      </nav>

      {/* "More" sheet (phones) */}
      <AnimatePresence>
        {isMoreOpen && (
          <>
            <motion.div
              className="md:hidden fixed inset-0 z-40 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMoreOpen(false)}
            />
            <motion.div
              className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-3xl shadow-2xl px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-h-[85vh] overflow-y-auto"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              <div className="w-10 h-1.5 bg-gray-200 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-terracotta/10 flex-shrink-0 flex items-center justify-center text-terracotta font-bold">
                    {user?.displayName?.[0] || user?.email?.[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink truncate">{user?.displayName || user?.email}</p>
                    <p className="text-xs text-gray-400 capitalize">{user?.role || 'Administrator'}</p>
                  </div>
                </div>
                <button onClick={() => setIsMoreOpen(false)} className="p-2 rounded-full bg-gray-100 text-gray-500">
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                {moreItems.map(item => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex flex-col items-center justify-center gap-2 py-4 rounded-2xl text-center transition-colors ${
                      item.to !== '/' && isActive(item.to) ? 'bg-terracotta text-white' : 'bg-cream text-ink'
                    }`}
                  >
                    <span className={item.to !== '/' && isActive(item.to) ? 'text-white' : 'text-terracotta'}>{item.icon}</span>
                    <span className="text-xs font-semibold leading-tight px-1">{item.label}</span>
                  </Link>
                ))}
              </div>

              {isAdmin && <PushToggle className="w-full justify-center py-3 mb-3" />}

              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-red-600 bg-red-50 font-semibold"
              >
                <LogOut size={18} /> Sign Out
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
