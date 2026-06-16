import { describe, it, expect, beforeEach } from 'vitest';
import { useEligibilityStore } from './eligibilityStore';

describe('eligibilityStore', () => {
  beforeEach(() => {
    // Reset the store state before each test with default rules
    useEligibilityStore.getState().resetToDefaults();
  });

  describe('addRule', () => {
    it('adds a new rule with correct fields', () => {
      const store = useEligibilityStore.getState();

      const rule = store.addRule({
        state: 'CA',
        criteria: { field: 'age', operator: '>=', value: 18 },
        effectiveDate: '2024-01-01',
        createdBy: 'test-user',
      });

      expect(rule).toBeDefined();
      expect(rule.id).toBeDefined();
      expect(typeof rule.id).toBe('string');
      expect(rule.id.length).toBeGreaterThan(0);
      expect(rule.state).toBe('CA');
      expect(rule.criteria).toEqual({ field: 'age', operator: '>=', value: 18 });
      expect(rule.effectiveDate).toBe('2024-01-01');
      expect(rule.createdBy).toBe('test-user');
      expect(rule.version).toBe(1);

      const { rules } = useEligibilityStore.getState();
      const found = rules.find((r) => r.id === rule.id);
      expect(found).toBeDefined();
      expect(found.state).toBe('CA');
    });

    it('adds a rule with default values when optional fields are missing', () => {
      const store = useEligibilityStore.getState();

      const rule = store.addRule({});

      expect(rule).toBeDefined();
      expect(rule.state).toBe('*');
      expect(rule.criteria).toEqual({ field: '', operator: '==', value: '' });
      expect(rule.version).toBe(1);
      expect(rule.createdBy).toBe('unknown');
      expect(rule.effectiveDate).toBeDefined();
    });

    it('returns null when given null or non-object input', () => {
      const store = useEligibilityStore.getState();

      expect(store.addRule(null)).toBeNull();
      expect(store.addRule(undefined)).toBeNull();
      expect(store.addRule('string')).toBeNull();
    });

    it('adds multiple rules and all are stored', () => {
      const store = useEligibilityStore.getState();
      const initialCount = store.rules.length;

      store.addRule({
        state: 'NY',
        criteria: { field: 'income', operator: '<=', value: 40000 },
        effectiveDate: '2024-01-01',
      });

      store.addRule({
        state: 'TX',
        criteria: { field: 'age', operator: '>=', value: 0 },
        effectiveDate: '2024-01-01',
      });

      const { rules } = useEligibilityStore.getState();
      expect(rules.length).toBe(initialCount + 2);
    });

    it('persists added rules to localStorage', () => {
      const store = useEligibilityStore.getState();

      store.addRule({
        state: 'FL',
        criteria: { field: 'income', operator: '<=', value: 30000 },
        effectiveDate: '2024-06-01',
      });

      expect(localStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('getRules', () => {
    beforeEach(() => {
      const store = useEligibilityStore.getState();
      // Clear and set up specific rules for testing
      store.setRules([
        {
          id: 'wildcard-1',
          state: '*',
          criteria: { field: 'age', operator: '>=', value: 0 },
          effectiveDate: '2024-01-01',
          version: 1,
          createdBy: 'system',
        },
        {
          id: 'wildcard-2',
          state: '*',
          criteria: { field: 'income', operator: '<=', value: 50000 },
          effectiveDate: '2024-01-01',
          version: 1,
          createdBy: 'system',
        },
        {
          id: 'ca-1',
          state: 'CA',
          criteria: { field: 'age', operator: '>=', value: 0 },
          effectiveDate: '2024-01-01',
          version: 1,
          createdBy: 'system',
        },
        {
          id: 'ca-2',
          state: 'CA',
          criteria: { field: 'income', operator: '<=', value: 55000 },
          effectiveDate: '2024-01-01',
          version: 1,
          createdBy: 'system',
        },
        {
          id: 'ny-1',
          state: 'NY',
          criteria: { field: 'income', operator: '<=', value: 60000 },
          effectiveDate: '2024-01-01',
          version: 1,
          createdBy: 'system',
        },
      ]);
    });

    it('returns all rules when no state code is provided', () => {
      const store = useEligibilityStore.getState();
      const rules = store.getRules();

      expect(rules).toHaveLength(5);
    });

    it('returns state-specific rules when state code is provided', () => {
      const store = useEligibilityStore.getState();
      const caRules = store.getRules('CA');

      expect(caRules).toHaveLength(2);
      caRules.forEach((rule) => {
        expect(rule.state).toBe('CA');
      });
    });

    it('returns wildcard rules when no state-specific rules exist', () => {
      const store = useEligibilityStore.getState();
      const flRules = store.getRules('FL');

      expect(flRules).toHaveLength(2);
      flRules.forEach((rule) => {
        expect(rule.state).toBe('*');
      });
    });

    it('returns state-specific rules for NY', () => {
      const store = useEligibilityStore.getState();
      const nyRules = store.getRules('NY');

      expect(nyRules).toHaveLength(1);
      expect(nyRules[0].state).toBe('NY');
      expect(nyRules[0].criteria.field).toBe('income');
    });

    it('returns wildcard rules when state code is empty string', () => {
      const store = useEligibilityStore.getState();
      const rules = store.getRules('');

      expect(rules).toHaveLength(2);
      rules.forEach((rule) => {
        expect(rule.state).toBe('*');
      });
    });
  });

  describe('updateRule', () => {
    it('updates an existing rule and increments version', () => {
      const store = useEligibilityStore.getState();

      const rule = store.addRule({
        state: 'CA',
        criteria: { field: 'age', operator: '>=', value: 18 },
        effectiveDate: '2024-01-01',
        createdBy: 'test-user',
      });

      const updated = store.updateRule(rule.id, {
        criteria: { field: 'age', operator: '>=', value: 21 },
        effectiveDate: '2024-06-01',
      });

      expect(updated).toBeDefined();
      expect(updated.id).toBe(rule.id);
      expect(updated.criteria).toEqual({ field: 'age', operator: '>=', value: 21 });
      expect(updated.effectiveDate).toBe('2024-06-01');
      expect(updated.version).toBe(2);
    });

    it('preserves the original id when updates include an id field', () => {
      const store = useEligibilityStore.getState();

      const rule = store.addRule({
        state: 'NY',
        criteria: { field: 'income', operator: '<=', value: 40000 },
        effectiveDate: '2024-01-01',
      });

      const updated = store.updateRule(rule.id, {
        id: 'should-not-change',
        state: 'TX',
      });

      expect(updated).toBeDefined();
      expect(updated.id).toBe(rule.id);
      expect(updated.state).toBe('TX');
    });

    it('returns null when rule id is not found', () => {
      const store = useEligibilityStore.getState();

      const result = store.updateRule('non-existent-id', {
        state: 'CA',
      });

      expect(result).toBeNull();
    });

    it('returns null when id is empty or updates are invalid', () => {
      const store = useEligibilityStore.getState();

      expect(store.updateRule('', { state: 'CA' })).toBeNull();
      expect(store.updateRule(null, { state: 'CA' })).toBeNull();
      expect(store.updateRule('some-id', null)).toBeNull();
      expect(store.updateRule('some-id', 'not-an-object')).toBeNull();
    });

    it('persists updated rules to localStorage', () => {
      const store = useEligibilityStore.getState();

      const rule = store.addRule({
        state: 'CA',
        criteria: { field: 'age', operator: '>=', value: 18 },
        effectiveDate: '2024-01-01',
      });

      const callCountBefore = localStorage.setItem.mock.calls.length;

      store.updateRule(rule.id, { state: 'NY' });

      expect(localStorage.setItem.mock.calls.length).toBeGreaterThan(callCountBefore);
    });

    it('increments version on each update', () => {
      const store = useEligibilityStore.getState();

      const rule = store.addRule({
        state: 'CA',
        criteria: { field: 'age', operator: '>=', value: 18 },
        effectiveDate: '2024-01-01',
      });

      expect(rule.version).toBe(1);

      const updated1 = store.updateRule(rule.id, { state: 'NY' });
      expect(updated1.version).toBe(2);

      const updated2 = store.updateRule(rule.id, { state: 'TX' });
      expect(updated2.version).toBe(3);
    });
  });

  describe('deleteRule', () => {
    it('deletes an existing rule and returns true', () => {
      const store = useEligibilityStore.getState();

      const rule = store.addRule({
        state: 'CA',
        criteria: { field: 'age', operator: '>=', value: 18 },
        effectiveDate: '2024-01-01',
      });

      const initialCount = useEligibilityStore.getState().rules.length;

      const result = store.deleteRule(rule.id);

      expect(result).toBe(true);

      const { rules } = useEligibilityStore.getState();
      expect(rules.length).toBe(initialCount - 1);

      const found = rules.find((r) => r.id === rule.id);
      expect(found).toBeUndefined();
    });

    it('returns false when rule id is not found', () => {
      const store = useEligibilityStore.getState();

      const result = store.deleteRule('non-existent-id');

      expect(result).toBe(false);
    });

    it('returns false when id is empty or null', () => {
      const store = useEligibilityStore.getState();

      expect(store.deleteRule('')).toBe(false);
      expect(store.deleteRule(null)).toBe(false);
      expect(store.deleteRule(undefined)).toBe(false);
    });

    it('persists deletion to localStorage', () => {
      const store = useEligibilityStore.getState();

      const rule = store.addRule({
        state: 'CA',
        criteria: { field: 'age', operator: '>=', value: 18 },
        effectiveDate: '2024-01-01',
      });

      const callCountBefore = localStorage.setItem.mock.calls.length;

      store.deleteRule(rule.id);

      expect(localStorage.setItem.mock.calls.length).toBeGreaterThan(callCountBefore);
    });

    it('does not affect other rules when deleting one', () => {
      const store = useEligibilityStore.getState();

      const rule1 = store.addRule({
        state: 'CA',
        criteria: { field: 'age', operator: '>=', value: 18 },
        effectiveDate: '2024-01-01',
      });

      const rule2 = store.addRule({
        state: 'NY',
        criteria: { field: 'income', operator: '<=', value: 40000 },
        effectiveDate: '2024-01-01',
      });

      store.deleteRule(rule1.id);

      const { rules } = useEligibilityStore.getState();
      const found = rules.find((r) => r.id === rule2.id);
      expect(found).toBeDefined();
      expect(found.state).toBe('NY');
    });
  });

  describe('determineEligibility', () => {
    beforeEach(() => {
      const store = useEligibilityStore.getState();
      store.setRules([
        {
          id: 'wildcard-age',
          state: '*',
          criteria: { field: 'age', operator: '>=', value: 0 },
          effectiveDate: '2024-01-01',
          version: 1,
          createdBy: 'system',
        },
        {
          id: 'wildcard-income',
          state: '*',
          criteria: { field: 'income', operator: '<=', value: 50000 },
          effectiveDate: '2024-01-01',
          version: 1,
          createdBy: 'system',
        },
        {
          id: 'ca-age',
          state: 'CA',
          criteria: { field: 'age', operator: '>=', value: 0 },
          effectiveDate: '2024-01-01',
          version: 1,
          createdBy: 'system',
        },
        {
          id: 'ca-income',
          state: 'CA',
          criteria: { field: 'income', operator: '<=', value: 55000 },
          effectiveDate: '2024-01-01',
          version: 1,
          createdBy: 'system',
        },
      ]);
    });

    it('returns Eligible when member meets all criteria for their state', () => {
      const store = useEligibilityStore.getState();

      const member = {
        id: 'member-1',
        memberId: 'M001',
        firstName: 'John',
        lastName: 'Doe',
        demographics: {
          age: 35,
          address: { state: 'CA' },
        },
        income: 40000,
      };

      const result = store.determineEligibility(member, 'CA');

      expect(result).toBe('Eligible');
    });

    it('returns Ineligible when member income exceeds state threshold', () => {
      const store = useEligibilityStore.getState();

      const member = {
        id: 'member-2',
        memberId: 'M002',
        firstName: 'Jane',
        lastName: 'Smith',
        demographics: {
          age: 30,
          address: { state: 'CA' },
        },
        income: 60000,
      };

      const result = store.determineEligibility(member, 'CA');

      expect(result).toBe('Ineligible');
    });

    it('returns Eligible when member meets wildcard rules for unknown state', () => {
      const store = useEligibilityStore.getState();

      const member = {
        id: 'member-3',
        memberId: 'M003',
        firstName: 'Bob',
        lastName: 'Jones',
        demographics: {
          age: 45,
          address: { state: 'FL' },
        },
        income: 30000,
      };

      const result = store.determineEligibility(member, 'FL');

      expect(result).toBe('Eligible');
    });

    it('returns Ineligible when member income exceeds wildcard threshold', () => {
      const store = useEligibilityStore.getState();

      const member = {
        id: 'member-4',
        memberId: 'M004',
        firstName: 'Alice',
        lastName: 'Brown',
        demographics: {
          age: 28,
          address: { state: 'FL' },
        },
        income: 55000,
      };

      const result = store.determineEligibility(member, 'FL');

      expect(result).toBe('Ineligible');
    });

    it('returns Pending when no rules are configured', () => {
      const store = useEligibilityStore.getState();
      store.setRules([]);

      const member = {
        id: 'member-5',
        memberId: 'M005',
        firstName: 'Charlie',
        lastName: 'Wilson',
        demographics: { age: 40 },
        income: 30000,
      };

      const result = store.determineEligibility(member, 'CA');

      expect(result).toBe('Pending');
    });

    it('returns Pending when member is null or undefined', () => {
      const store = useEligibilityStore.getState();

      expect(store.determineEligibility(null, 'CA')).toBe('Pending');
      expect(store.determineEligibility(undefined, 'CA')).toBe('Pending');
    });

    it('returns Pending when member is not an object', () => {
      const store = useEligibilityStore.getState();

      expect(store.determineEligibility('string', 'CA')).toBe('Pending');
      expect(store.determineEligibility(123, 'CA')).toBe('Pending');
    });

    it('returns Ineligible when a field value is null or undefined for a required criterion', () => {
      const store = useEligibilityStore.getState();

      const member = {
        id: 'member-6',
        memberId: 'M006',
        firstName: 'Dave',
        lastName: 'Miller',
        demographics: {
          age: 25,
          address: { state: 'CA' },
        },
        // income is undefined
      };

      const result = store.determineEligibility(member, 'CA');

      expect(result).toBe('Ineligible');
    });

    it('handles nested field resolution via dot notation in criteria', () => {
      const store = useEligibilityStore.getState();

      store.setRules([
        {
          id: 'state-rule',
          state: '*',
          criteria: { field: 'demographics.address.state', operator: '==', value: 'CA' },
          effectiveDate: '2024-01-01',
          version: 1,
          createdBy: 'system',
        },
      ]);

      const caMember = {
        id: 'member-7',
        memberId: 'M007',
        demographics: {
          address: { state: 'CA' },
        },
      };

      const nyMember = {
        id: 'member-8',
        memberId: 'M008',
        demographics: {
          address: { state: 'NY' },
        },
      };

      expect(store.determineEligibility(caMember)).toBe('Eligible');
      expect(store.determineEligibility(nyMember)).toBe('Ineligible');
    });

    it('handles the exists operator correctly', () => {
      const store = useEligibilityStore.getState();

      store.setRules([
        {
          id: 'exists-rule',
          state: '*',
          criteria: { field: 'coverage', operator: 'exists', value: true },
          effectiveDate: '2024-01-01',
          version: 1,
          createdBy: 'system',
        },
      ]);

      const memberWithCoverage = {
        id: 'member-9',
        memberId: 'M009',
        coverage: 'Health - MEDICAID STANDARD',
      };

      const memberWithoutCoverage = {
        id: 'member-10',
        memberId: 'M010',
        coverage: '',
      };

      expect(store.determineEligibility(memberWithCoverage)).toBe('Eligible');
      expect(store.determineEligibility(memberWithoutCoverage)).toBe('Ineligible');
    });

    it('handles != operator correctly', () => {
      const store = useEligibilityStore.getState();

      store.setRules([
        {
          id: 'not-equal-rule',
          state: '*',
          criteria: { field: 'demographics.genderCode', operator: '!=', value: 'U' },
          effectiveDate: '2024-01-01',
          version: 1,
          createdBy: 'system',
        },
      ]);

      const maleMember = {
        id: 'member-11',
        memberId: 'M011',
        demographics: { genderCode: 'M' },
      };

      const unknownGenderMember = {
        id: 'member-12',
        memberId: 'M012',
        demographics: { genderCode: 'U' },
      };

      expect(store.determineEligibility(maleMember)).toBe('Eligible');
      expect(store.determineEligibility(unknownGenderMember)).toBe('Ineligible');
    });

    it('handles < operator correctly', () => {
      const store = useEligibilityStore.getState();

      store.setRules([
        {
          id: 'less-than-rule',
          state: '*',
          criteria: { field: 'age', operator: '<', value: 65 },
          effectiveDate: '2024-01-01',
          version: 1,
          createdBy: 'system',
        },
      ]);

      const youngMember = {
        id: 'member-13',
        memberId: 'M013',
        demographics: { age: 30 },
      };

      const oldMember = {
        id: 'member-14',
        memberId: 'M014',
        demographics: { age: 70 },
      };

      expect(store.determineEligibility(youngMember)).toBe('Eligible');
      expect(store.determineEligibility(oldMember)).toBe('Ineligible');
    });

    it('handles > operator correctly', () => {
      const store = useEligibilityStore.getState();

      store.setRules([
        {
          id: 'greater-than-rule',
          state: '*',
          criteria: { field: 'income', operator: '>', value: 0 },
          effectiveDate: '2024-01-01',
          version: 1,
          createdBy: 'system',
        },
      ]);

      const memberWithIncome = {
        id: 'member-15',
        memberId: 'M015',
        income: 25000,
      };

      const memberWithZeroIncome = {
        id: 'member-16',
        memberId: 'M016',
        income: 0,
      };

      expect(store.determineEligibility(memberWithIncome)).toBe('Eligible');
      expect(store.determineEligibility(memberWithZeroIncome)).toBe('Ineligible');
    });

    it('uses state-specific rules over wildcard rules', () => {
      const store = useEligibilityStore.getState();

      // CA has income <= 55000, wildcard has income <= 50000
      // A member with income 52000 should be Eligible in CA but Ineligible in FL (wildcard)
      const member = {
        id: 'member-17',
        memberId: 'M017',
        demographics: { age: 30 },
        income: 52000,
      };

      const caResult = store.determineEligibility(member, 'CA');
      const flResult = store.determineEligibility(member, 'FL');

      expect(caResult).toBe('Eligible');
      expect(flResult).toBe('Ineligible');
    });

    it('returns Pending when all rules have future effective dates', () => {
      const store = useEligibilityStore.getState();

      store.setRules([
        {
          id: 'future-rule',
          state: '*',
          criteria: { field: 'age', operator: '>=', value: 0 },
          effectiveDate: '2099-01-01',
          version: 1,
          createdBy: 'system',
        },
      ]);

      const member = {
        id: 'member-18',
        memberId: 'M018',
        demographics: { age: 30 },
      };

      const result = store.determineEligibility(member);

      expect(result).toBe('Pending');
    });

    it('handles multiple criteria where all must pass for Eligible', () => {
      const store = useEligibilityStore.getState();

      store.setRules([
        {
          id: 'multi-1',
          state: '*',
          criteria: { field: 'age', operator: '>=', value: 18 },
          effectiveDate: '2024-01-01',
          version: 1,
          createdBy: 'system',
        },
        {
          id: 'multi-2',
          state: '*',
          criteria: { field: 'income', operator: '<=', value: 50000 },
          effectiveDate: '2024-01-01',
          version: 1,
          createdBy: 'system',
        },
        {
          id: 'multi-3',
          state: '*',
          criteria: { field: 'coverage', operator: 'exists', value: true },
          effectiveDate: '2024-01-01',
          version: 1,
          createdBy: 'system',
        },
      ]);

      const eligibleMember = {
        id: 'member-19',
        memberId: 'M019',
        demographics: { age: 25 },
        income: 30000,
        coverage: 'Health - MEDICAID STANDARD',
      };

      const ineligibleByAge = {
        id: 'member-20',
        memberId: 'M020',
        demographics: { age: 10 },
        income: 30000,
        coverage: 'Health - MEDICAID STANDARD',
      };

      const ineligibleByIncome = {
        id: 'member-21',
        memberId: 'M021',
        demographics: { age: 25 },
        income: 60000,
        coverage: 'Health - MEDICAID STANDARD',
      };

      const ineligibleByCoverage = {
        id: 'member-22',
        memberId: 'M022',
        demographics: { age: 25 },
        income: 30000,
        coverage: '',
      };

      expect(store.determineEligibility(eligibleMember)).toBe('Eligible');
      expect(store.determineEligibility(ineligibleByAge)).toBe('Ineligible');
      expect(store.determineEligibility(ineligibleByIncome)).toBe('Ineligible');
      expect(store.determineEligibility(ineligibleByCoverage)).toBe('Ineligible');
    });

    it('handles == operator correctly for string comparison', () => {
      const store = useEligibilityStore.getState();

      store.setRules([
        {
          id: 'eq-rule',
          state: '*',
          criteria: { field: 'demographics.citizenshipStatusCode', operator: '==', value: '1' },
          effectiveDate: '2024-01-01',
          version: 1,
          createdBy: 'system',
        },
      ]);

      const citizenMember = {
        id: 'member-23',
        memberId: 'M023',
        demographics: { citizenshipStatusCode: '1' },
      };

      const nonCitizenMember = {
        id: 'member-24',
        memberId: 'M024',
        demographics: { citizenshipStatusCode: '2' },
      };

      expect(store.determineEligibility(citizenMember)).toBe('Eligible');
      expect(store.determineEligibility(nonCitizenMember)).toBe('Ineligible');
    });

    it('skips rules with missing criteria fields', () => {
      const store = useEligibilityStore.getState();

      store.setRules([
        {
          id: 'empty-criteria',
          state: '*',
          criteria: { field: '', operator: '', value: '' },
          effectiveDate: '2024-01-01',
          version: 1,
          createdBy: 'system',
        },
        {
          id: 'valid-rule',
          state: '*',
          criteria: { field: 'age', operator: '>=', value: 0 },
          effectiveDate: '2024-01-01',
          version: 1,
          createdBy: 'system',
        },
      ]);

      const member = {
        id: 'member-25',
        memberId: 'M025',
        demographics: { age: 30 },
      };

      // Should skip the empty criteria rule and evaluate the valid one
      const result = store.determineEligibility(member);
      expect(result).toBe('Eligible');
    });

    it('skips rules with null criteria', () => {
      const store = useEligibilityStore.getState();

      store.setRules([
        {
          id: 'null-criteria',
          state: '*',
          criteria: null,
          effectiveDate: '2024-01-01',
          version: 1,
          createdBy: 'system',
        },
        {
          id: 'valid-rule',
          state: '*',
          criteria: { field: 'age', operator: '>=', value: 18 },
          effectiveDate: '2024-01-01',
          version: 1,
          createdBy: 'system',
        },
      ]);

      const member = {
        id: 'member-26',
        memberId: 'M026',
        demographics: { age: 25 },
      };

      const result = store.determineEligibility(member);
      expect(result).toBe('Eligible');
    });
  });

  describe('setRules', () => {
    it('replaces all rules with the provided array', () => {
      const store = useEligibilityStore.getState();

      const newRules = [
        {
          state: 'TX',
          criteria: { field: 'age', operator: '>=', value: 21 },
          effectiveDate: '2024-01-01',
        },
      ];

      store.setRules(newRules);

      const { rules } = useEligibilityStore.getState();
      expect(rules).toHaveLength(1);
      expect(rules[0].state).toBe('TX');
      expect(rules[0].id).toBeDefined();
    });

    it('does nothing when given non-array input', () => {
      const store = useEligibilityStore.getState();
      const initialRules = [...store.rules];

      store.setRules(null);
      expect(useEligibilityStore.getState().rules).toEqual(initialRules);

      store.setRules('not-an-array');
      expect(useEligibilityStore.getState().rules).toEqual(initialRules);

      store.setRules(123);
      expect(useEligibilityStore.getState().rules).toEqual(initialRules);
    });

    it('normalizes rules with default values for missing fields', () => {
      const store = useEligibilityStore.getState();

      store.setRules([{}]);

      const { rules } = useEligibilityStore.getState();
      expect(rules).toHaveLength(1);
      expect(rules[0].state).toBe('*');
      expect(rules[0].criteria).toEqual({ field: '', operator: '==', value: '' });
      expect(rules[0].version).toBe(1);
      expect(rules[0].createdBy).toBe('unknown');
    });

    it('persists rules to localStorage', () => {
      const store = useEligibilityStore.getState();

      store.setRules([
        {
          state: 'CA',
          criteria: { field: 'age', operator: '>=', value: 0 },
          effectiveDate: '2024-01-01',
        },
      ]);

      expect(localStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('resetToDefaults', () => {
    it('resets rules to the default set', () => {
      const store = useEligibilityStore.getState();

      // Add custom rules
      store.addRule({
        state: 'CA',
        criteria: { field: 'age', operator: '>=', value: 21 },
        effectiveDate: '2024-01-01',
      });

      store.addRule({
        state: 'NY',
        criteria: { field: 'income', operator: '<=', value: 30000 },
        effectiveDate: '2024-01-01',
      });

      // Reset
      store.resetToDefaults();

      const { rules, defaultRules } = useEligibilityStore.getState();
      expect(rules).toHaveLength(defaultRules.length);

      // Verify default rules are present
      const wildcardRules = rules.filter((r) => r.state === '*');
      expect(wildcardRules.length).toBe(2);

      const ageRule = wildcardRules.find((r) => r.criteria.field === 'age');
      expect(ageRule).toBeDefined();
      expect(ageRule.criteria.operator).toBe('>=');
      expect(ageRule.criteria.value).toBe(0);

      const incomeRule = wildcardRules.find((r) => r.criteria.field === 'income');
      expect(incomeRule).toBeDefined();
      expect(incomeRule.criteria.operator).toBe('<=');
      expect(incomeRule.criteria.value).toBe(50000);
    });

    it('persists default rules to localStorage', () => {
      const store = useEligibilityStore.getState();

      store.resetToDefaults();

      expect(localStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('standalone functions', () => {
    it('setRules standalone function works correctly', async () => {
      const { setRules } = await import('./eligibilityStore');

      setRules([
        {
          state: 'OH',
          criteria: { field: 'age', operator: '>=', value: 0 },
          effectiveDate: '2024-01-01',
        },
      ]);

      const { rules } = useEligibilityStore.getState();
      expect(rules).toHaveLength(1);
      expect(rules[0].state).toBe('OH');
    });

    it('getRules standalone function works correctly', async () => {
      const { getRules, setRules } = await import('./eligibilityStore');

      setRules([
        {
          state: '*',
          criteria: { field: 'age', operator: '>=', value: 0 },
          effectiveDate: '2024-01-01',
        },
        {
          state: 'CA',
          criteria: { field: 'income', operator: '<=', value: 55000 },
          effectiveDate: '2024-01-01',
        },
      ]);

      const allRules = getRules();
      expect(allRules).toHaveLength(2);

      const caRules = getRules('CA');
      expect(caRules).toHaveLength(1);
      expect(caRules[0].state).toBe('CA');
    });

    it('determineEligibility standalone function works correctly', async () => {
      const { determineEligibility, setRules } = await import('./eligibilityStore');

      setRules([
        {
          state: '*',
          criteria: { field: 'age', operator: '>=', value: 18 },
          effectiveDate: '2024-01-01',
        },
      ]);

      const eligibleMember = {
        id: 'standalone-1',
        demographics: { age: 25 },
      };

      const ineligibleMember = {
        id: 'standalone-2',
        demographics: { age: 10 },
      };

      expect(determineEligibility(eligibleMember)).toBe('Eligible');
      expect(determineEligibility(ineligibleMember)).toBe('Ineligible');
    });
  });

  describe('edge cases', () => {
    it('handles member with demographics resolved from top-level age field', () => {
      const store = useEligibilityStore.getState();

      store.setRules([
        {
          id: 'age-rule',
          state: '*',
          criteria: { field: 'age', operator: '>=', value: 18 },
          effectiveDate: '2024-01-01',
          version: 1,
          createdBy: 'system',
        },
      ]);

      // age at top level (not in demographics)
      const member = {
        id: 'edge-1',
        memberId: 'E001',
        age: 25,
      };

      const result = store.determineEligibility(member);
      expect(result).toBe('Eligible');
    });

    it('handles member with age inside demographics sub-object', () => {
      const store = useEligibilityStore.getState();

      store.setRules([
        {
          id: 'age-rule',
          state: '*',
          criteria: { field: 'age', operator: '>=', value: 18 },
          effectiveDate: '2024-01-01',
          version: 1,
          createdBy: 'system',
        },
      ]);

      const member = {
        id: 'edge-2',
        memberId: 'E002',
        demographics: { age: 25 },
      };

      const result = store.determineEligibility(member);
      expect(result).toBe('Eligible');
    });

    it('handles boundary value for <= operator', () => {
      const store = useEligibilityStore.getState();

      store.setRules([
        {
          id: 'boundary-rule',
          state: '*',
          criteria: { field: 'income', operator: '<=', value: 50000 },
          effectiveDate: '2024-01-01',
          version: 1,
          createdBy: 'system',
        },
      ]);

      const exactBoundary = {
        id: 'edge-3',
        memberId: 'E003',
        income: 50000,
      };

      const justOver = {
        id: 'edge-4',
        memberId: 'E004',
        income: 50001,
      };

      expect(store.determineEligibility(exactBoundary)).toBe('Eligible');
      expect(store.determineEligibility(justOver)).toBe('Ineligible');
    });

    it('handles boundary value for >= operator', () => {
      const store = useEligibilityStore.getState();

      store.setRules([
        {
          id: 'boundary-rule',
          state: '*',
          criteria: { field: 'age', operator: '>=', value: 18 },
          effectiveDate: '2024-01-01',
          version: 1,
          createdBy: 'system',
        },
      ]);

      const exactBoundary = {
        id: 'edge-5',
        memberId: 'E005',
        demographics: { age: 18 },
      };

      const justUnder = {
        id: 'edge-6',
        memberId: 'E006',
        demographics: { age: 17 },
      };

      expect(store.determineEligibility(exactBoundary)).toBe('Eligible');
      expect(store.determineEligibility(justUnder)).toBe('Ineligible');
    });

    it('returns Pending when no state code is provided and no wildcard rules exist', () => {
      const store = useEligibilityStore.getState();

      store.setRules([
        {
          id: 'ca-only',
          state: 'CA',
          criteria: { field: 'age', operator: '>=', value: 0 },
          effectiveDate: '2024-01-01',
          version: 1,
          createdBy: 'system',
        },
      ]);

      const member = {
        id: 'edge-7',
        memberId: 'E007',
        demographics: { age: 30 },
      };

      // No state code provided, no wildcard rules
      const result = store.determineEligibility(member, '');
      expect(result).toBe('Pending');
    });
  });
});