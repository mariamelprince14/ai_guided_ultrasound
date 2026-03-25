import React from 'react';
import clsx from 'clsx';
import styles from './Card.module.css';

interface CardProps {
    title?: React.ReactNode;
    subtitle?: string;
    footer?: React.ReactNode;
    children: React.ReactNode;
    onClick?: () => void;
    selected?: boolean;
    className?: string;
}

export const Card: React.FC<CardProps> = ({
    title,
    subtitle,
    footer,
    children,
    onClick,
    selected,
    className,
}) => {
    return (
        <div
            className={clsx(
                styles.card,
                onClick && styles.clickable,
                selected && styles.selected,
                className
            )}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
        >
            {(title || subtitle) && (
                <div className={styles.header}>
                    {title && <h3 className={styles.title}>{title}</h3>}
                    {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
                </div>
            )}
            <div className={styles.content}>{children}</div>
            {footer && <div className={styles.footer}>{footer}</div>}
        </div>
    );
};
