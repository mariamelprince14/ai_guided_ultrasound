import React from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import styles from './AppLayout.module.css';

interface AppLayoutProps {
    children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
    const location = useLocation();
    const isTrainingRoute = location.pathname.startsWith('/training') || location.pathname === '/workspace';
    const isHomepage = location.pathname === '/' || location.pathname === '/setup' || location.pathname === '/results' || location.pathname === '/status';

    if (isTrainingRoute) {
        return (
            <div className={styles.fullScreenLayout}>
                <main className={styles.fullScreenContent}>{children}</main>
            </div>
        );
    }

    if (isHomepage) {
        return (
            <div className={styles.homepageLayout}>
                <main className={styles.homepageContent}>{children}</main>
            </div>
        );
    }
    
    return (
        <div className={styles.layout}>
            <Sidebar />
            <div className={styles.main}>
                <TopBar />
                <main className={styles.content}>{children}</main>
            </div>
        </div>
    );
};
