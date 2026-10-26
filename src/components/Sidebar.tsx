import React from 'react';
import {
  LayoutDashboard,
  Video,
  ShieldCheck
} from 'lucide-react';

export type NavTab = 'dashboard' | 'monitoring' | 'risk_engine';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  unresolvedIncidentsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab
}) => {
  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'Main Dashboard',
      icon: LayoutDashboard,
      description: 'System overview & metrics'
    },
    {
      id: 'monitoring' as NavTab,
      label: 'Live Monitoring',
      icon: Video,
      description: 'CCTV feed & track overlays'
    },
    {
      id: 'risk_engine' as NavTab,
      label: 'Risk Detection Engine',
      icon: ShieldCheck,
      description: 'Rules A, B, C, D & thresholds'
    }
  ];

  return (
    <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 h-screen sticky top-0">
      {/* Brand & Academic Header */}
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-slate-100 text-base tracking-tight leading-none">
              CampusGuard <span className="text-blue-400">AI</span>
            </h1>
            <p className="text-[11px] text-slate-400 mt-1 leading-tight">
              Pedestrian Safety & Monitoring
            </p>
          </div>
        </div>


      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <div className="truncate">
                  <div className="truncate">{item.label}</div>
                  <div className={`text-[10px] font-normal truncate ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
                    {item.description}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </nav>


    </aside>
  );
};
