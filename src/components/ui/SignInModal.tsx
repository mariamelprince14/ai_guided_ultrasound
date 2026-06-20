import React, { useState } from 'react';
import { Modal } from './Modal';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import styles from './SignInModal.module.css';

interface SignInModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSwitchToSignUp: () => void;
}

export const SignInModal: React.FC<SignInModalProps> = ({
    isOpen,
    onClose,
    onSwitchToSignUp,
}) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
    const [isLoading, setIsLoading] = useState(false);

    const handleSignIn = async (data: any) => {
        console.log("Sign In:", data);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const newErrors: { email?: string; password?: string } = {};
        if (!email.trim()) {
            newErrors.email = 'Email address is required';
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            newErrors.email = 'Please enter a valid email address';
        }
        
        if (!password) {
            newErrors.password = 'Password is required';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setErrors({});
        setIsLoading(true);
        try {
            await handleSignIn({ email, password, rememberMe });
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={
                <div className={styles.modalTitle}>
                    <span>Sign In</span>
                </div>
            }
        >
            <form onSubmit={handleSubmit} className={styles.form} noValidate>
                <div className={styles.inputGroup}>
                    <label htmlFor="signin-email" className={styles.label}>
                        Email Address
                    </label>
                    <div className={styles.inputWrapper}>
                        <Mail className={styles.inputIcon} size={18} />
                        <input
                            id="signin-email"
                            type="email"
                            placeholder="name@institution.edu"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                            }}
                            className={errors.email ? styles.inputError : styles.input}
                            required
                        />
                    </div>
                    {errors.email && (
                        <span className={styles.errorText} id="signin-email-error">
                            <AlertCircle size={14} /> {errors.email}
                        </span>
                    )}
                </div>

                <div className={styles.inputGroup}>
                    <div className={styles.labelRow}>
                        <label htmlFor="signin-password" className={styles.label}>
                            Password
                        </label>
                        <a 
                            href="#" 
                            onClick={(e) => { e.preventDefault(); console.log("Forgot Password clicked"); }} 
                            className={styles.forgotLink}
                        >
                            Forgot Password?
                        </a>
                    </div>
                    <div className={styles.inputWrapper}>
                        <Lock className={styles.inputIcon} size={18} />
                        <input
                            id="signin-password"
                            type="password"
                            placeholder="Enter password"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                            }}
                            className={errors.password ? styles.inputError : styles.input}
                            required
                        />
                    </div>
                    {errors.password && (
                        <span className={styles.errorText} id="signin-password-error">
                            <AlertCircle size={14} /> {errors.password}
                        </span>
                    )}
                </div>

                <div className={styles.rememberGroup}>
                    <label className={styles.checkboxContainer}>
                        <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                        />
                        <span className={styles.checkboxLabel}>Remember Me</span>
                    </label>
                </div>

                <button 
                    type="submit" 
                    className={styles.submitBtn}
                    disabled={isLoading}
                >
                    {isLoading ? 'Signing In...' : 'Sign In'}
                </button>

                <div className={styles.footerPrompt}>
                    Don't have an account?{' '}
                    <button 
                        type="button" 
                        onClick={onSwitchToSignUp} 
                        className={styles.switchBtn}
                    >
                        Sign up
                    </button>
                </div>
            </form>
        </Modal>
    );
};
