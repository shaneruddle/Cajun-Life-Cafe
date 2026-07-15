import { useState } from 'react';
import FinanceOverview from './FinanceOverview';
import LogExpense from './LogExpense';
import LogIncome from './LogIncome';
import Ingredients from './Ingredients';
import FinanceReports from './FinanceReports';
import FinanceLedger from './FinanceLedger';
import { LayoutDashboard, Receipt, TrendingUp, Scale, FileBarChart, List } from 'lucide-react';

type FinanceRole = 'owner' | 'manager' | 'cashier';

function getFinanceRole(user: any): FinanceRole {
  if (!user) return 'cashier';
  if (user.email?.toLowerCase() === 'info@cajunlifecafe.com' || user.role === 'admin') return 'owner';
  if (user.role === 'manager') return 'manager';
  return 'cashier';
}

const ALL_TABS = [
  { id: 'overview',     label: 'Overview',     icon: <LayoutDashboard size={16} />, roles: ['owner', 'manager'] },
  { id: 'expense',      label: 'Log Expense',  icon: <Receipt size={16} />,         roles: ['owner', 'manager', 'cashier'] },
  { id: 'income',       label: 'Log Income',   icon: <TrendingUp size={16} />,      roles: ['owner', 'manager', 'cashier'] },
  { id: 'ledger',       label: 'Ledger',       icon: <List size={16} />,            roles: ['owner', 'manager'] },
  { id: 'ingredients',  label: 'Ingredients',  icon: <Scale size={16} />,           roles: ['owner', 'manager'] },
  { id: 'reports',      label: 'Reports',      icon: <FileBarChart size={16} />,    roles: ['owner'] },
];

export default function FinanceDashboard({ user }: { user: any }) {
  const financeRole = getFinanceRole(user);
  const tabs = ALL_TABS.filter(t => t.roles.includes(financeRole));
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || 'expense');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tab nav */}
      <div className="bg-white border-b border-gray-100 px-6 sticky top-0 z-10">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-terracotta text-terracotta'
                  : 'border-transparent text-gray-500 hover:text-ink'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview'    && <FinanceOverview financeRole={financeRole} />}
        {activeTab === 'expense'     && <LogExpense user={user} financeRole={financeRole} />}
        {activeTab === 'income'      && <LogIncome user={user} financeRole={financeRole} />}
        {activeTab === 'ledger'      && <FinanceLedger user={user} financeRole={financeRole} />}
        {activeTab === 'ingredients' && <Ingredients />}
        {activeTab === 'reports'     && <FinanceReports />}
      </div>
    </div>
  );
}
