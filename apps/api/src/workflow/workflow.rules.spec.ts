import { decideFit, nextStage } from './workflow.rules';

const base = { bedroomsApproved: 2, maxRentCents: 250000, bedrooms: 2, askingRentCents: 240000,
  utilitiesIncluded: { heat: true, hot_water: true, electric: true, gas: true },
  utilityResponsibility: { heat: false, hot_water: false, electric: false, gas: false } };

describe('workflow FSM', () => {
  it('allows documented early transitions and withdrawal', () => {
    expect(nextStage('INQUIRY', 'intake_completed')).toBe('INTAKE');
    expect(nextStage('INTAKE', 'voucher_submitted')).toBe('VOUCHER_REVIEW');
    expect(nextStage('VOUCHER_REVIEW', 'needs_info')).toBe('INTAKE');
    expect(nextStage('DOCUMENT_COLLECT', 'readiness_reached')).toBe('READY');
    expect(nextStage('MATCHED', 'unit_lost')).toBe('READY');
    expect(nextStage('MATCHED', 'withdraw')).toBe('WITHDRAWN');
  });
  it('fails closed for downstream or terminal actions', () => {
    expect(() => nextStage('MATCHED', 'showing_completed_ok')).toThrow();
    expect(() => nextStage('INQUIRY', 'unit_matched')).toThrow();
    expect(() => nextStage('PLACED', 'withdraw')).toThrow();
  });
});
describe('objective fit', () => {
  it('filters bedrooms and asking rent without a score', () => {
    expect(decideFit(base)).toEqual({ result: 'ELIGIBLE', reasons: expect.any(Array) });
    expect(decideFit({ ...base, bedrooms: 1 }).result).toBe('INELIGIBLE');
    expect(decideFit({ ...base, askingRentCents: 260000 }).result).toBe('INELIGIBLE');
  });
  it('returns review for unknown utility data and tenant-paid utilities, not guessed eligible', () => {
    expect(decideFit({ ...base, utilitiesIncluded: null }).result).toBe('NEEDS_REVIEW');
    expect(decideFit({ ...base, utilitiesIncluded: { ...base.utilitiesIncluded, heat: false } }).result).toBe('NEEDS_REVIEW');
    expect(decideFit({ ...base, utilityResponsibility: { ...base.utilityResponsibility, heat: true } }).result).toBe('NEEDS_REVIEW');
  });
});
