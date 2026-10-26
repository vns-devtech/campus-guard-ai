import React from 'react';
import { UserRole } from '../types';

interface HeaderProps {
  title: string;
  subtitle: string;
  role?: UserRole;
  onRoleChange?: (newRole: UserRole) => void;
  demoMode?: boolean;
  onToggleDemoMode?: (enabled: boolean) => void;
  audioAlerts?: boolean;
  onToggleAudioAlerts?: () => void;
  newAlertCount?: number;
  onAlertsClick?: () => void;
  onConnectPhoneClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle
}) => {
  return (
    <header className="h-16 px-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 sticky top-0 z-20">
      {/* Title & Subtitle */}
      <div>
        <h2 className="text-base font-semibold text-slate-100">{title}</h2>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>
    </header>
  );
};
