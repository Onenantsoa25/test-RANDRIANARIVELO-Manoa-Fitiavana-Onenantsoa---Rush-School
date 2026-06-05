// src/part2/types/index.ts

export interface RawContact {
  siren: string;
  email: string;
  societe: string;
  source: string;
}

export interface CleanContact {
  id?: number;
  siren: string;
  email: string;
  emailNormalized: string;
  societe: string;
  source: string;
  status: 'valid' | 'rejected';
  rejectionReason?: string;
  isGenericEmail: boolean;
  isDisposableEmail: boolean;
  hasValidMx: boolean;
  originalRow: RawContact;
}

export interface DeduplicationResult {
  kept: CleanContact[];
  merged: {
    primary: CleanContact;
    duplicates: CleanContact[];
  }[];
}

export interface ValidationReport {
  totalInput: number;
  kept: number;
  rejected: number;
  rejectionBreakdown: {
    invalidSiren: number;
    invalidEmailSyntax: number;
    invalidMx: number;
    genericEmail: number;
    disposableEmail: number;
    duplicate: number;
  };
  details: {
    rowIndex: number;
    originalData: RawContact;
    action: 'kept' | 'rejected' | 'merged';
    reason?: string;
    mergedInto?: number;
  }[];
}

export interface NormalizedSiren {
  raw: string;
  normalized: string | null;
  isValid: boolean;
}

export interface EmailValidationResult {
  raw: string;
  normalized: string;
  isValid: boolean;
  isGeneric: boolean;
  isDisposable: boolean;
  hasValidMx: boolean;
  domain: string | null;
  localPart: string | null;
}