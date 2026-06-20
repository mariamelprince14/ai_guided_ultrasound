import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Stethoscope } from 'lucide-react';
import styles from './HomepageNavbar.module.css';
import clsx from 'clsx';

interface HomepageNavbarProps {
    onSignInClick?: () => void;
    onSignUpClick?: () => void;
}

export const HomepageNavbar: React.FC<HomepageNavbarProps> = ({
    onSignInClick,
    onSignUpClick,
}) => {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <nav className={clsx(styles.navbar, scrolled && styles.scrolled)} id="homepage-navbar">
            <div className={styles.navbarInner}>
                <div className={styles.brand}>
                    <div className={styles.brandIcon}>
                        <Stethoscope size={20} />
                    </div>
                    <span className={styles.brandName}>US Training System</span>
                </div>

                <div className={styles.navLinks}>
                    <NavLink
                        to="/"
                        className={({ isActive }) => clsx(styles.navLink, isActive && styles.active)}
                        end
                    >
                        Mode Selection
                    </NavLink>
                    <NavLink
                        to="/setup"
                        className={({ isActive }) => clsx(styles.navLink, isActive && styles.active)}
                    >
                        Sessions
                    </NavLink>
                    <NavLink
                        to="/workspace"
                        className={({ isActive }) => clsx(styles.navLink, isActive && styles.active)}
                    >
                        Workspace
                    </NavLink>
                    <NavLink
                        to="/results"
                        className={({ isActive }) => clsx(styles.navLink, isActive && styles.active)}
                    >
                        Progress
                    </NavLink>
                    <NavLink
                        to="/status"
                        className={({ isActive }) => clsx(styles.navLink, isActive && styles.active)}
                    >
                        Status
                    </NavLink>
                </div>

                <div className={styles.authGroup}>
                    <button 
                        className={styles.signInLink} 
                        onClick={(e) => {
                            console.log("Sign In clicked");
                            onSignInClick?.();
                        }}
                    >
                        Sign in
                    </button>
                    <button 
                        className={styles.signUpBtn} 
                        onClick={(e) => {
                            console.log("Sign Up clicked");
                            onSignUpClick?.();
                        }}
                    >
                        Sign up
                    </button>
                </div>
            </div>
        </nav>
    );
};
