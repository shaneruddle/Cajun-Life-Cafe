import { useState } from 'react';
import FinanceOverview from './FinanceOverview';
import LogExpense from './LogExpense';
import LogIncome from './LogIncome';
import Ingredients from './Ingredients';
import FinanceReports from './FinanceReports';
import { LayoutDashboard, Receipt, TrendingUp, Scale, FileBarChart } from 'lucide-react';

const TABS = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={16} /> },
  { id: 'expense', label: 'Log Expense', icon: <Receipt size={16} /> },
  { id: 'income', label: 'Log Income', icon: <TrendingUp size={16} /> },
  { id: 'ingredients', label: 'Ingredients', icon: <Scale size={16} /> },
  { id: 'reports', label: 'Reports', icon: <FileBarChart size={16} /> },
];

export default function FinanceDashboard({ user }: { user: any }) {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tab nav */}
      <div className="bg-white border-b border-gray-100 px-6 sticky top-0 z-10">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(tab => (
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
        {activeTab === 'overview' && <FinanceOverview />}
        {activeTab === 'expense' && <LogExpense user={user} />}
        {activeTab === 'income' && <LogIncome user={user} />}
        {activeTab === 'ingredients' && <Ingredients />}
        {activeTab === 'reports' && <FinanceReports />}
      </div>
    </div>
  );
}
