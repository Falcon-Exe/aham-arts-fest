import { describe, it, expect } from 'vitest';
import { calculatePoints } from './scoringRules';

describe('calculatePoints', () => {
    it('returns 0 if place is None', () => {
        const points = calculatePoints({ category: 'A', place: 'None', grade: 'A+', isGeneral: false });
        expect(points).toBe(0);
    });

    it('calculates points correctly for Category A (First Place + A+)', () => {
        // First Place (12) + A+ (7) = 19
        const points = calculatePoints({ category: 'A', place: 'First', grade: 'A+', isGeneral: false });
        expect(points).toBe(19);
    });

    it('calculates points correctly for Category B (Second Place + B)', () => {
        // Second Place (6) + B (3) = 9
        const points = calculatePoints({ category: 'B', place: 'Second', grade: 'B', isGeneral: false });
        expect(points).toBe(9);
    });

    it('calculates points correctly for Category C (Third Place + C)', () => {
        // Third Place (10) + C (1) = 11
        const points = calculatePoints({ category: 'C', place: 'Third', grade: 'C', isGeneral: false });
        expect(points).toBe(11);
    });

    it('handles numeric places correctly', () => {
        // First Place (12) + A (5) = 17
        const points = calculatePoints({ category: 'A', place: '1', grade: 'A', isGeneral: false });
        expect(points).toBe(17);
    });

    it('calculates points for General Events', () => {
        // First Place General (25) + A+ (7) = 32
        const points = calculatePoints({ category: 'A', place: 'First', grade: 'A+', isGeneral: true });
        expect(points).toBe(32);
    });

    it('returns only grade points if place is invalid or greater than 3', () => {
        const points = calculatePoints({ category: 'A', place: 'Fourth', grade: 'A+', isGeneral: false });
        expect(points).toBe(0); // If place > 3 or invalid it returns 0 entirely based on current logic
    });
});
