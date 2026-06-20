import React, { useState } from 'react';
import { Modal } from './Modal';
import { User, Mail, Lock, Briefcase, AlertCircle } from 'lucide-react';
import styles from './SignUpModal.module.css';

interface SignUpModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSwitchToSignIn: () => void;
}

export const SignUpModal: React.FC<SignUpModalProps> = ({
    isOpen,
    onClose,
    onSwitchToSignIn,
}) => {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState('');
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [errors, setErrors] = useState<{
        fullName?: string;
        email?: string;
        password?: string;
        confirmPassword?: string;
        role?: string;
        acceptTerms?: string;
    }>({});
    const [isLoading, setIsLoading] = useState(false);

    const handleSignUp = async (data: any) => {
        console.log("Sign Up:", data);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const newErrors: typeof errors = {};

        if (!fullName.trim()) {
            newErrors.fullName = 'Full name is required';
        }

        if (!email.trim()) {
            newErrors.email = 'Email address is required';
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            newErrors.email = 'Please enter a valid email address';
        }

        if (!password) {
            newErrors.password = 'Password is required';
        } else if (password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters';
        }

        if (!confirmPassword) {
            newErrors.confirmPassword = 'Confirm password is required';
        } else if (password !== confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        if (!role) {
            newErrors.role = 'Please select your role';
        }

        if (!acceptTerms) {
            newErrors.acceptTerms = 'You must accept the terms and conditions';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setErrors({});
        setIsLoading(true);
        try {
            await handleSignUp({
                fullName,
                email,
                password,
                role,
                acceptTerms,
            });
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
                    <span>Sign Up</span>
                </div>
            }
        >
            <form onSubmit={handleSubmit} className={styles.form} noValidate>
                <div className={styles.inputGroup}>
                    <label htmlFor="signup-fullname" className={styles.label}>
                        Full Name
                    </label>
                    <div className={styles.inputWrapper}>
                        <User className={styles.inputIcon} size={18} />
                        <input
                            id="signup-fullname"
                            type="text"
                            placeholder="John Doe"
                            value={fullName}
                            onChange={(e) => {
                                setFullName(e.target.value);
                                if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
                            }}
                            className={errors.fullName ? styles.inputError : styles.input}
                            required
                        />
                    </div>
                    {errors.fullName && (
                        <span className={styles.errorText} id="signup-fullname-error">
                            <AlertCircle size={14} /> {errors.fullName}
                        </span>
                    )}
                </div>

                <div className={styles.inputGroup}>
                    <label htmlFor="signup-email" className={styles.label}>
                        Email Address
                    </label>
                    <div className={styles.inputWrapper}>
                        <Mail className={styles.inputIcon} size={18} />
                        <input
                            id="signup-email"
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
                        <span className={styles.errorText} id="signup-email-error">
                            <AlertCircle size={14} /> {errors.email}
                        </span>
                    )}
                </div>

                <div className={styles.gridTwoCols}>
                    <div className={styles.inputGroup}>
                        <label htmlFor="signup-password" className={styles.label}>
                            Password
                        </label>
                        <div className={styles.inputWrapper}>
                            <Lock className={styles.inputIcon} size={18} />
                            <input
                                id="signup-password"
                                type="password"
                                placeholder="Min. 8 chars"
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
                            <span className={styles.errorText} id="signup-password-error">
                                <AlertCircle size={14} /> {errors.password}
                            </span>
                        )}
                    </div>

                    <div className={styles.inputGroup}>
                        <label htmlFor="signup-confirmpassword" className={styles.label}>
                            Confirm Password
                        </label>
                        <div className={styles.inputWrapper}>
                            <Lock className={styles.inputIcon} size={18} />
                            <input
                                id="signup-confirmpassword"
                                type="password"
                                placeholder="Repeat password"
                                value={confirmPassword}
                                onChange={(e) => {
                                    setConfirmPassword(e.target.value);
                                    if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                                }}
                                className={errors.confirmPassword ? styles.inputError : styles.input}
                                required
                            />
                        </div>
                        {errors.confirmPassword && (
                            <span className={styles.errorText} id="signup-confirmpassword-error">
                                <AlertCircle size={14} /> {errors.confirmPassword}
                            </span>
                        )}
                    </div>
                </div>

                <div className={styles.inputGroup}>
                    <label htmlFor="signup-role" className={styles.label}>
                        Role
                    </label>
                    <div className={styles.inputWrapper}>
                        <Briefcase className={styles.inputIcon} size={18} />
                        <select
                            id="signup-role"
                            value={role}
                            onChange={(e) => {
                                setRole(e.target.value);
                                if (errors.role) setErrors((prev) => ({ ...prev, role: undefined }));
                            }}
                            className={errors.role ? styles.selectError : styles.select}
                            required
                        >
                            <option value="" disabled>Select your role</option>
                            <option value="Student">Student</option>
                            <option value="Trainee">Trainee</option>
                            <option value="Instructor">Instructor</option>
                            <option value="Expert">Expert</option>
                        </select>
                    </div>
                    {errors.role && (
                        <span className={styles.errorText} id="signup-role-error">
                            <AlertCircle size={14} /> {errors.role}
                        </span>
                    )}
                </div>

                <div className={styles.termsGroup}>
                    <label className={styles.checkboxContainer}>
                        <input
                            type="checkbox"
                            checked={acceptTerms}
                            onChange={(e) => {
                                setAcceptTerms(e.target.checked);
                                if (errors.acceptTerms) setErrors((prev) => ({ ...prev, acceptTerms: undefined }));
                            }}
                        />
                        <span className={styles.checkboxLabel}>
                            I agree to the{' '}
                            <a href="#" onClick={(e) => { e.preventDefault(); console.log("Terms & Conditions clicked"); }} className={styles.termsLink}>
                                Terms and Conditions
                            </a>
                        </span>
                    </label>
                    {errors.acceptTerms && (
                        <span className={styles.errorText} id="signup-terms-error">
                            <AlertCircle size={14} /> {errors.acceptTerms}
                        </span>
                    )}
                </div>

                <button
                    type="submit"
                    className={styles.submitBtn}
                    disabled={isLoading}
                >
                    {isLoading ? 'Creating Account...' : 'Sign Up'}
                </button>

                <div className={styles.footerPrompt}>
                    Already have an account?{' '}
                    <button
                        type="button"
                        onClick={onSwitchToSignIn}
                        className={styles.switchBtn}
                    >
                        Sign in
                    </button>
                </div>
            </form>
        </Modal>
    );
};
