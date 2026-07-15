import React, { useState } from 'react';
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
  Newspaper
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

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

export default function DashboardLayout({ user }: { user: any }) {
  const isAdmin = user?.email?.toLowerCase() === 'info@cajunlifecafe.com' || user?.role === 'admin';
  const canSeeFinance = isAdmin || user?.role === 'manager' || user?.role === 'cashier';
  const financeRole = getFinanceRole(user);
  const financeTabs = FINANCE_TABS.filter(t => t.roles.includes(financeRole));
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentFinanceTab = searchParams.get('tab') || financeTabs[0]?.id;
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [isFinanceOpen, setIsFinanceOpen] = useState(location.pathname.startsWith('/dashboard/finance'));
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const isActive = (path: string) => location.pathname === path;
  const isSubActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div className="flex min-h-screen bg-cream">
      {/* Sidebar */}
      <aside className={`${isCollapsed ? 'w-20' : 'w-64'} bg-white border-r border-gray-100 flex flex-col fixed h-screen z-20 transition-all duration-300 ease-in-out`}>
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
            <SidebarItem
              icon={<LayoutGrid size={20} />}
              label="Menu"
              hasSubmenu
              isOpen={isMenuOpen}
              isCollapsed={isCollapsed}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              isActive={isSubActive('/dashboard/menu') || isActive('/dashboard') || isActive('/dashboard/categories') || isActive('/dashboard/custom-meals')}
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
                </>
              )}
            </SidebarItem>
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

          {(user?.role === 'admin' || user?.role === 'manager') && (
            <SidebarItem
              icon={<Briefcase size={20} />}
              label="Job Postings"
              to="/dashboard/jobs"
              isCollapsed={isCollapsed}
              isActive={isActive('/dashboard/jobs')}
            />
          )}

          {user?.role === 'admin' && (
            <SidebarItem
              icon={<Users size={20} />}
              label="CRM & Directory"
              to="/dashboard/crm"
              isCollapsed={isCollapsed}
              isActive={isActive('/dashboard/crm')}
            />
          )}

          {user?.role === 'admin' && (
            <SidebarItem
              icon={<Users size={20} />}
              label="Users"
              to="/dashboard/users"
              isCollapsed={isCollapsed}
              isActive={isActive('/dashboard/users')}
            />
          )}

          {(user?.role === 'admin' || user?.role === 'marketing') && (
            <SidebarItem
              icon={<ImageIcon size={20} />}
              label="Image Management"
              to="/dashboard/images"
              isCollapsed={isCollapsed}
              isActive={isActive('/dashboard/images')}
            />
          )}

          {(user?.role === 'admin' || user?.role === 'marketing') && (
            <SidebarItem
              icon={<Newspaper size={20} />}
              label="Blog"
              to="/dashboard/blog"
              isCollapsed={isCollapsed}
              isActive={isActive('/dashboard/blog')}
            />
          )}

          {user?.role === 'admin' && (
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
      <main className={`flex-1 ${isCollapsed ? 'ml-20' : 'ml-64'} min-h-screen transition-all duration-300 ease-in-out`}>
        <Outlet />
      </main>
    </div>
  );
}
