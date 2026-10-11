import { BadRequestException } from '@nestjs/common';
import { CaseStage, FitResult } from '@vhp/database';

// Only transitions whose evidence is stored in Phase 1-3 are supported. Later
// steps (showing, agency, lease, inspection, keys) fail closed until artifacts exist.
export const transitions: Partial<Record<CaseStage, Record<string, CaseStage>>> = {
  INQUIRY: { intake_completed: 'INTAKE' },
  INTAKE: { voucher_submitted: 'VOUCHER_REVIEW' },
  VOUCHER_REVIEW: { voucher_verified: 'DOCUMENT_COLLECT', needs_info: 'INTAKE', voucher_invalid: 'INELIGIBLE' },
  DOCUMENT_COLLECT: { readiness_reached: 'READY' },
  READY: { unit_matched: 'MATCHED' },
  MATCHED: { unit_lost: 'READY' },
};
export function nextStage(from: CaseStage, action: string): CaseStage {
  if (action === 'withdraw' && !['PLACED', 'INELIGIBLE', 'WITHDRAWN'].includes(from)) return 'WITHDRAWN';
  const next = transitions[from]?.[action];
  if (!next) throw new BadRequestException('Transition unsupported or invalid from current stage');
  return next;
}

export const FIT_RULE_VERSION = 'bedrooms-rent-v1';
// Does not use program, household demographics, geography or a ranking score.
// No guessed allowance: tenant-paid or unknown utilities require manual review.
export function decideFit(input: {
  bedroomsApproved: number; maxRentCents: number; bedrooms: number;
  askingRentCents: number; utilitiesIncluded: unknown; utilityResponsibility: unknown;
}): { result: FitResult; reasons: string[] } {
  const reasons: string[] = [];
  if (!Number.isInteger(input.bedroomsApproved) || !Number.isInteger(input.bedrooms) || input.bedrooms < 0 || input.bedroomsApproved < 0 || !Number.isInteger(input.maxRentCents) || !Number.isInteger(input.askingRentCents) || input.maxRentCents < 0 || input.askingRentCents < 0) {
    return { result: 'NEEDS_REVIEW', reasons: ['Invalid or missing economic inputs'] };
  }
  if (input.bedrooms !== input.bedroomsApproved) reasons.push('Bedrooms do not match voucher approval');
  if (input.askingRentCents > input.maxRentCents) reasons.push('Asking rent exceeds voucher maximum before utilities');
  if (reasons.length) return { result: 'INELIGIBLE', reasons };
  const keys = ['heat', 'hot_water', 'electric', 'gas'];
  const included = input.utilitiesIncluded;
  const responsibility = input.utilityResponsibility;
  if (!included || typeof included !== 'object' || Array.isArray(included) || !responsibility || typeof responsibility !== 'object' || Array.isArray(responsibility) ||
      keys.some(k => typeof (included as Record<string, unknown>)[k] !== 'boolean' || typeof (responsibility as Record<string, unknown>)[k] !== 'boolean') ||
      keys.some(k => !(included as Record<string, boolean>)[k] || (responsibility as Record<string, boolean>)[k])) {
    return { result: 'NEEDS_REVIEW', reasons: ['Utility allowance/split is unresolved; no verified schedule calculation'] };
  }
  return { result: 'ELIGIBLE', reasons: ['Bedrooms and asking rent fit; all listed utilities included'] };
}
