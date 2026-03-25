import React from 'react';
import styles from './WorkspaceLayout.module.css';

interface WorkspaceLayoutProps {
    leftPanel: React.ReactNode;
    centerPanel: React.ReactNode;
    rightPanel: React.ReactNode;
    header?: React.ReactNode;
}

export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
    leftPanel,
    centerPanel,
    rightPanel,
    header,
}) => {
    return (
        <div className={styles.workspace}>
            {header && <div className={styles.header}>{header}</div>}
            <div className={styles.grid}>
                <div className={styles.leftPanel}>{leftPanel}</div>
                <div className={styles.centerPanel}>{centerPanel}</div>
                <div className={styles.rightPanel}>{rightPanel}</div>
            </div>
        </div>
    );
};
