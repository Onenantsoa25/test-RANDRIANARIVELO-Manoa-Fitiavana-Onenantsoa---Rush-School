// src/part2/cleaners/normalizer.ts

import { NormalizedSiren, EmailValidationResult } from '../types/index.js';

/**
 * Normalise un SIREN (9 chiffres)
 * - Supprime les espaces, tirets, points
 * - Verifie qu'il contient exactement 9 chiffres
 * - "—" (tiret long) est considere comme invalide
 */
export function normalizeSiren(rawSiren: string): NormalizedSiren {
  if (!rawSiren || rawSiren === '—') {
    return {
      raw: rawSiren,
      normalized: null,
      isValid: false
    };
  }
  
  // Supprimer tous les caracteres non numeriques
  const cleaned = rawSiren.replace(/[^\d]/g, '');
  
  // Verifier qu'on a exactement 9 chiffres
  const isValid = cleaned.length === 9;
  
  return {
    raw: rawSiren,
    normalized: isValid ? cleaned : null,
    isValid
  };
}

/**
 * Normalise une adresse email
 * - Met en minuscules
 * - Supprime les espaces
 */
export function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.toLowerCase().trim().replace(/\s/g, '');
}

/**
 * Liste des domaines d'emails jetables
 */
const DISPOSABLE_DOMAINS = [
  'mailinator.com',
  'guerrillamail.com',
  'tempmail.com',
  '10minutemail.com',
  'throwaway.com',
  'yopmail.com',
  'temp-mail.org',
  'mailnator.com',
  'trashmail.com',
  'spamgourmet.com'
];

/**
 * Liste des patterns d'emails generiques
 */
const GENERIC_PATTERNS = [
  /^contact[@]/i,
  /^info[@]/i,
  /^direction[@]/i,
  /^commercial[@]/i,
  /^support[@]/i,
  /^hello[@]/i,
  /^bonjour[@]/i,
  /^service[@]/i,
  /^admin[@]/i
];

/**
 * Valide la syntaxe d'un email (regex simple mais robuste)
 */
function isValidEmailSyntax(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * Verifie si l'email est generique (contact@, info@, etc.)
 */
function isGenericEmail(email: string): boolean {
  const lowerEmail = email.toLowerCase();
  return GENERIC_PATTERNS.some(pattern => pattern.test(lowerEmail));
}

/**
 * Verifie si l'email utilise un domaine jetable
 */
function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.some(disposable => domain === disposable || domain.endsWith(`.${disposable}`));
}

/**
 * Mock de verification MX
 * En production, on ferait une requete DNS pour verifier que le domaine accepte des emails
 */
async function checkMxRecords(domain: string): Promise<boolean> {
  // Mock: on considere que tous les domaines .fr, .com, .org sont valides
  // Les domaines invalides comme "test.local" sont rejetes
  const validTlds = ['fr', 'com', 'org', 'net', 'io', 'co', 'eu'];
  const tld = domain.split('.').pop()?.toLowerCase();
  
  if (!tld) return false;
  if (validTlds.includes(tld)) return true;
  
  // Pour la demo, on simule aussi quelques domaines connus valides
  const validDomains = ['gmail.com', 'outlook.com', 'yahoo.com', 'protonmail.com'];
  if (validDomains.includes(domain)) return true;
  
  // Simuler un timeout aleatoire pour tester la robustesse
  await new Promise(resolve => setTimeout(resolve, 10));
  
  return false;
}

/**
 * Validation complete d'un email
 */
export async function validateEmail(email: string): Promise<EmailValidationResult> {
  const normalized = normalizeEmail(email);
  const isValidSyntax = isValidEmailSyntax(normalized);
  
  let hasValidMx = false;
  let domain = null;
  let localPart = null;
  
  if (isValidSyntax) {
    const parts = normalized.split('@');
    localPart = parts[0];
    domain = parts[1];
    hasValidMx = await checkMxRecords(domain);
  }
  
  const isGeneric = isValidSyntax && isGenericEmail(normalized);
  const isDisposable = isValidSyntax && isDisposableEmail(normalized);
  
  // Un email est globalement valide si :
  // - Syntaxe OK
  // - MX valide
  // - N'est PAS un email jetable
  // (Les emails generiques sont valides mais flagged separement)
  const isValid = isValidSyntax && hasValidMx && !isDisposable;
  
  return {
    raw: email,
    normalized,
    isValid,
    isGeneric,
    isDisposable,
    hasValidMx,
    domain,
    localPart
  };
}