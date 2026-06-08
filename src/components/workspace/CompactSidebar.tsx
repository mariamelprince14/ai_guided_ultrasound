/**
 * CompactSidebar.tsx
 * ──────────────────
 * Collapsible professional navigation sidebar
 * Replaces bulky left panel with icon-first, minimal design
 */

import React, { useState } from 'react';
import {
    ChevronLeft,
    Home,
    Radio,
    Crosshair,
    BarChart3,
    HelpCircle,
    Settings,
    LogOut,
    Eye,
    Zap,
    GraduationCap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@store/useAppStore';
import styles from './CompactSidebar.module.css';

interface CompactSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CompactSidebar: React.FC<CompactSidebarProps> = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const { resetSession } = useAppStore();
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

    const navigationGroups = [
        {
            id: 'workspace',
            label: 'Workspace',
            items: [
                { icon: <Home size={18} />, label: 'Dashboard', action: () => navigate('/') },
                {
                    icon: <Radio size={18} />,
                    label: 'Training Mode',
                    action: () => navigate('/workspace'),
                },
            ],
        },
        {
            id: 'training',
            label: 'Training Tools',
            items: [
                {
                    icon: <Crosshair size={18} />,
                    label: 'Target Identification',
                    action: () => navigate('/training/identification'),
                },
                {
                    icon: <BarChart3 size={18} />,
                    label: 'Assessment',
                    action: () => navigate('/training/assessment'),
                },
            ],
        },
        {
            id: 'quick-settings',
            label: 'Quick Settings',
            items: [
                { icon: <Eye size={18} />, label: 'Visualization' },
                { icon: <Zap size={18} />, label: 'Performance' },
                { icon: <GraduationCap size={18} />, label: 'Learning' },
            ],
        },
        {
            id: 'help',
            label: 'Support',
            items: [
                { icon: <HelpCircle size={18} />, label: 'Help & Docs' },
                { icon: <Settings size={18} />, label: 'Settings' },
            ],
        },
    ];

    const handleLogout = () => {
        resetSession();
        navigate('/');
        onClose();
    };

    return (
        <>
            {/* Overlay */}
            {isOpen && <div className={styles.overlay} onClick={onClose} />}

            {/* Sidebar */}
            <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.logo}>
                        <Radio size={24} />
                        <span className={styles.logoText}>USim</span>
                    </div>
                    <button className={styles.closeButton} onClick={onClose}>
                        <ChevronLeft size={20} />
                    </button>
                </div>

                {/* Divider */}
                <div className={styles.divider} />

                {/* Navigation Groups */}
                <nav className={styles.nav}>
                    {navigationGroups.map(group => (
                        <div key={group.id} className={styles.navGroup}>
                            <button
                                className={styles.groupLabel}
                                onClick={() =>
                                    setExpandedGroup(
                                        expandedGroup === group.id ? null : group.id
                                    )
                                }
                            >
                                <span>{group.label}</span>
                                <ChevronLeft
                                    size={14}
                                    className={`${styles.chevron} ${
                                        expandedGroup === group.id ? styles.expanded : ''
                                    }`}
                                />
                            </button>

                            {expandedGroup === group.id && (
                                <div className={styles.navItems}>
                                    {group.items.map((item, idx) => (
                                        <button
                                            key={idx}
                                            className={styles.navItem}
                                            onClick={() => {
                                                item.action?.();
                                                onClose();
                                            }}
                                            title={item.label}
                                        >
                                            <span className={styles.icon}>{item.icon}</span>
                                            <span className={styles.label}>{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </nav>

                {/* Bottom Actions */}
                <div className={styles.bottom}>
                    <button
                        className={styles.bottomButton}
                        onClick={handleLogout}
                        title="Exit Training"
                    >
                        <LogOut size={18} />
                        <span>Exit Training</span>
                    </button>
                </div>
            </aside>
        </>
    );
};
