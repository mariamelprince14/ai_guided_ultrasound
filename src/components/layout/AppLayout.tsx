import React from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import styles from './AppLayout.module.css';

interface AppLayoutProps {
    children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
    console.log('AppLayout rendering, children:', children)
    
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
