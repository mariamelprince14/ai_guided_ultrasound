import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Settings,
    Activity,
    LineChart,
    ShieldCheck,
    HelpCircle
} from 'lucide-react';
import styles from './Sidebar.module.css';

export const Sidebar: React.FC = () => {
    const navItems = [
        { path: '/', label: 'Mode Selection', icon: <LayoutDashboard size={18} /> },
        { path: '/setup', label: 'Session Setup', icon: <Settings size={18} /> },
        { path: '/workspace', label: 'Training Workspace', icon: <Activity size={18} /> },
        { path: '/results', label: 'Progress & Results', icon: <LineChart size={18} /> },
        { path: '/status', label: 'System Status', icon: <ShieldCheck size={18} /> },
        { path: '/help', label: 'Help & FAQ', icon: <HelpCircle size={18} /> },
    ];

    return (
        <aside className={styles.sidebar}>
            <div className={styles.header}>
                <h1 className={styles.title}>US Training</h1>
                <p className={styles.subtitle}>AI-Guided System</p>
            </div>
            <nav className={styles.nav}>
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `${styles.navItem} ${isActive ? styles.active : ''} `
                        }
                    >
                        <span className={styles.icon}>{item.icon}</span>
                        <span className={styles.label}>{item.label}</span>
                    </NavLink>
                ))}
            </nav>
            <div className={styles.footer}>
                <p className={styles.disclaimer}>Training system only</p>
                <p className={styles.disclaimerSub}>No diagnostic use</p>
            </div>
        </aside>
    );
};
