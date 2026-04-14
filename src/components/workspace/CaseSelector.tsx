/**
 * CaseSelector.tsx
 * ─────────────────
 * Dropdown component showing all discovered CT cases from the backend.
 * Fetches on mount via GET /api/cases and updates the Zustand store.
 */
import React, { useEffect, useState } from 'react';
import { useAppStore } from '@store/useAppStore';
import { apiService } from '@services/api';
import styles from './CaseSelector.module.css';

interface CaseSelectorProps {
    onSelect?: (caseId: string) => void;
    className?: string;
}

export const CaseSelector: React.FC<CaseSelectorProps> = ({ onSelect, className }) => {
    const { cases, setCases, selectedCaseId, setSelectedCaseId } = useAppStore();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (cases.length > 0) return; // already loaded
        
        const fetchCases = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await apiService.getCases();
                setCases(res.cases);
                // Auto-select first case
                if (res.cases.length > 0 && !selectedCaseId) {
                    setSelectedCaseId(res.cases[0].id);
                    onSelect?.(res.cases[0].id);
                }
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Failed to load cases');
            } finally {
                setLoading(false);
            }
        };

        fetchCases();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setSelectedCaseId(id);
        onSelect?.(id);
    };

    if (error) {
        return (
            <div className={`${styles.container} ${className || ''}`}>
                <div className={styles.error}>
                    <span className={styles.errorIcon}>⚠</span>
                    {error}
                </div>
            </div>
        );
    }

    return (
        <div className={`${styles.container} ${className || ''}`}>
            <label htmlFor="case-selector" className={styles.label}>
                CT Case
            </label>
            <div className={styles.selectWrapper}>
                <select
                    id="case-selector"
                    className={styles.select}
                    value={selectedCaseId || ''}
                    onChange={handleChange}
                    disabled={loading || cases.length === 0}
                >
                    {loading && <option value="">Loading cases...</option>}
                    {!loading && cases.length === 0 && (
                        <option value="">No cases found</option>
                    )}
                    {cases.map(c => (
                        <option key={c.id} value={c.id}>
                            {c.name} {c.has_segmentation ? '🔵' : ''}
                        </option>
                    ))}
                </select>
                <span className={styles.selectArrow}>▾</span>
                {loading && <span className={styles.spinner} />}
            </div>
            {selectedCaseId && cases.length > 0 && (
                <div className={styles.meta}>
                    {cases.find(c => c.id === selectedCaseId)?.has_segmentation
                        ? '🔵 Segmentation available'
                        : '○ No segmentation'}
                    {' · '}
                    {cases.length} cases total
                </div>
            )}
        </div>
    );
};
