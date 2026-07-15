import { useSearchParams } from 'react-router-dom';
import FinanceOverview from './FinanceOverview';
import LogExpense from './LogExpense';
import LogIncome from './LogIncome';
import Ingredients from './Ingredients';
import FinanceReports from './FinanceReports';
import FinanceLedger from './FinanceLedger';
import { LayoutDashboard, Receipt, TrendingUp, Scale, FileBarChart, List } from 'lucide-react';

export type FinanceRole = 'owner' | 'manager' | 'cashier';

export function getFinanceRole(user: any): FinanceRole {
  if (!user) return 'cashier';
  if (user.email?.toLowerCase() === 'info@cajunlifecafe.com' || user.role === 'admin') return 'owner';
  if (user.role === 'manager') return 'manager';
  return 'cashier';
}

// Shared with the Finance submenu in DashboardLayout.tsx, which links here
// via ?tab= query params instead of an in-page tab bar.
export const FINANCE_TABS = [
  { id: 'overview',     label: 'Overview',     icon: <LayoutDashboard size={16} />, roles: ['owner', 'manager'] },
  { id: 'expense',      label: 'Log Expense',  icon: <Receipt size={16} />,         roles: ['owner', 'manager', 'cashier'] },
  { id: 'income',       label: 'Log Income',   icon: <TrendingUp size={16} />,      roles: ['owner', 'manager', 'cashier'] },
  { id: 'ledger',       label: 'Ledger',       icon: <List size={16} />,            roles: ['owner', 'manager'] },
  { id: 'ingredients',  label: 'Ingredients',  icon: <Scale size={16} />,           roles: ['owner', 'manager'] },
  { id: 'reports',      label: 'Reports',      icon: <FileBarChart size={16} />,    roles: ['owner'] },
];

export default function FinanceDashboard({ user }: { user: any }) {
  const financeRole = getFinanceRole(user);
  const tabs = FINANCE_TABS.filter(t => t.roles.includes(financeRole));
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab = tabs.find(t => t.id === requestedTab)?.id || tabs[0]?.id || 'expense';

  return (
    <div className="min-h-screen bg-gray-50">
      {activeTab === 'overview'    && <FinanceOverview financeRole={financeRole} />}
      {activeTab === 'expense'     && <LogExpense user={user} financeRole={financeRole} />}
      {activeTab === 'income'      && <LogIncome user={user} financeRole={financeRole} />}
      {activeTab === 'ledger'      && <FinanceLedger user={user} financeRole={financeRole} />}
      {activeTab === 'ingredients' && <Ingredients />}
      {activeTab === 'reports'     && <FinanceReports />}
    </div>
  );
}
