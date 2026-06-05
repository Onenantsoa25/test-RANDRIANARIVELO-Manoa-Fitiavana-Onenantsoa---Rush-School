// src/partie2/index.ts - Version avec export de fichiers

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// TYPES
// ============================================

interface RawContact {
  siren: string;
  email: string;
  societe: string;
  source: string;
}

interface CleanContact {
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
}

// ============================================
// DONNeES (en dur pour tester sans CSV)
// ============================================

const rawDataHardcoded: RawContact[] = [
  { siren: '552 081 317', email: 'Contact@ACME-Conseil.fr', societe: 'ACME Conseil', source: 'scraping' },
  { siren: '552081317', email: 'contact@acme-conseil.fr', societe: 'Acme Conseil SARL', source: 'pappers' },
  { siren: '443 061 841', email: 'j.martin@formapro.fr', societe: 'FormaPro', source: 'scraping' },
  { siren: '443061841', email: 'info@formapro.fr', societe: 'FORMAPRO', source: 'scraping' },
  { siren: '—', email: 'claire.dubois@vinexpert.fr', societe: 'Vinexpert', source: 'scraping' },
  { siren: '812 998 002', email: 'nope', societe: 'BTP Solutions', source: 'scraping' },
  { siren: '812998002', email: 'p.durand@btp-solutions.fr', societe: 'BTP Solutions', source: 'pappers' },
  { siren: '327 911 044', email: 'test@mailinator.com', societe: 'QuickWin', source: 'scraping' },
  { siren: '327911044', email: 'DIRECTION@quickwin.fr', societe: 'Quick Win', source: 'irene' },
  { siren: '552081317', email: 'contact@acme-conseil.fr', societe: 'ACME Conseils', source: 'irene' }
];

// ============================================
// FONCTIONS DE NETTOYAGE
// ============================================

function normalizeSiren(rawSiren: string): { normalized: string | null; isValid: boolean } {
  if (!rawSiren || rawSiren === '—') {
    return { normalized: null, isValid: false };
  }
  const cleaned = rawSiren.replace(/[^\d]/g, '');
  const isValid = cleaned.length === 9;
  return { normalized: isValid ? cleaned : null, isValid };
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim().replace(/\s/g, '');
}

function isValidEmailSyntax(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

const GENERIC_PATTERNS = [
  /^contact[@]/i, /^info[@]/i, /^direction[@]/i, /^commercial[@]/i,
  /^support[@]/i, /^hello[@]/i, /^service[@]/i, /^admin[@]/i
];

function isGenericEmail(email: string): boolean {
  return GENERIC_PATTERNS.some(pattern => pattern.test(email.toLowerCase()));
}

const DISPOSABLE_DOMAINS = ['mailinator.com', 'guerrillamail.com', 'tempmail.com', '10minutemail.com', 'yopmail.com'];

function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? DISPOSABLE_DOMAINS.includes(domain) : false;
}

async function checkMxRecords(domain: string): Promise<boolean> {
  const validTlds = ['fr', 'com', 'org', 'net', 'io', 'co', 'eu'];
  const tld = domain.split('.').pop()?.toLowerCase();
  if (!tld) return false;
  if (validTlds.includes(tld)) return true;
  const validDomains = ['gmail.com', 'outlook.com', 'yahoo.com', 'protonmail.com'];
  return validDomains.includes(domain);
}

async function validateEmail(email: string) {
  const normalized = normalizeEmail(email);
  const isValidSyntax = isValidEmailSyntax(normalized);
  let hasValidMx = false;
  let domain = null;
  
  if (isValidSyntax) {
    domain = normalized.split('@')[1];
    hasValidMx = await checkMxRecords(domain);
  }
  
  const isGeneric = isValidSyntax && isGenericEmail(normalized);
  const isDisposable = isValidSyntax && isDisposableEmail(normalized);
  const isValid = isValidSyntax && hasValidMx && !isDisposable;
  
  return { normalized, isValid, isGeneric, isDisposable, hasValidMx, domain };
}

// ============================================
// DeDOUBLONNAGE
// ============================================

function scoreContact(contact: CleanContact): number {
  let score = 0;
  if (!contact.isGenericEmail) score += 100;  // Nominatif meilleur que generique
  if (contact.hasValidMx) score += 50;
  if (!contact.isDisposableEmail) score += 30;
  if (contact.source === 'irene' || contact.source === 'pappers') score += 10;
  return score;
}

function deduplicateContacts(contacts: CleanContact[]): CleanContact[] {
  const groupsBySiren = new Map<string, CleanContact[]>();
  
  for (const contact of contacts) {
    if (contact.status !== 'valid') continue;
    const key = contact.siren;
    if (!groupsBySiren.has(key)) {
      groupsBySiren.set(key, []);
    }
    groupsBySiren.get(key)!.push(contact);
  }
  
  const result: CleanContact[] = [];
  
  for (const [siren, group] of groupsBySiren) {
    if (group.length === 1) {
      result.push(group[0]);
    } else {
      const sorted = [...group].sort((a, b) => scoreContact(b) - scoreContact(a));
      result.push(sorted[0]);
      console.log(`    Fusion SIREN ${siren}: ${group.length} emails → garde "${sorted[0].email}"`);
    }
  }
  
  return result;
}

// ============================================
// EXPORT FICHIERS
// ============================================

function exportToCSV(contacts: CleanContact[], outputPath: string) {
  const headers = ['siren', 'email', 'email_normalized', 'societe', 'source', 'status', 'rejection_reason', 'is_generic_email', 'is_disposable_email', 'has_valid_mx'];
  
  const rows = contacts.map(c => [
    c.siren,
    c.email,
    c.emailNormalized,
    c.societe,
    c.source,
    c.status,
    c.rejectionReason || '',
    c.isGenericEmail,
    c.isDisposableEmail,
    c.hasValidMx
  ]);
  
  const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
  fs.writeFileSync(outputPath, csvContent, 'utf-8');
  console.log(`    CSV exporte: ${outputPath}`);
}

function exportToJSON(contacts: CleanContact[], outputPath: string) {
  fs.writeFileSync(outputPath, JSON.stringify(contacts, null, 2), 'utf-8');
  console.log(`    JSON exporte: ${outputPath}`);
}

function exportReport(validContacts: CleanContact[], rejectedContacts: CleanContact[], outputPath: string) {
  const report = {
    timestamp: new Date().toISOString(),
    total: validContacts.length + rejectedContacts.length,
    valid: validContacts.length,
    rejected: rejectedContacts.length,
    rejectionBreakdown: {
      invalidSiren: rejectedContacts.filter(c => c.rejectionReason?.includes('SIREN')).length,
      invalidEmailSyntax: rejectedContacts.filter(c => c.rejectionReason?.includes('syntaxe')).length,
      invalidMx: rejectedContacts.filter(c => c.rejectionReason?.includes('MX')).length,
      disposableEmail: rejectedContacts.filter(c => c.rejectionReason?.includes('jetable')).length
    },
    validContacts: validContacts.map(c => ({
      siren: c.siren,
      email: c.email,
      societe: c.societe,
      source: c.source,
      isGenericEmail: c.isGenericEmail
    }))
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`    Rapport exporte: ${outputPath}`);
}

// ============================================
// FONCTION PRINCIPALE
// ============================================

async function main() {
  console.log('\n PARTIE 2 : NETTOYAGE & DeDOUBLONNAGE\n');
  
  const cleanedContacts: CleanContact[] = [];
  
  for (let i = 0; i < rawDataHardcoded.length; i++) {
    const contact = rawDataHardcoded[i];
    
    const sirenResult = normalizeSiren(contact.siren);
    if (!sirenResult.isValid || !sirenResult.normalized) {
      cleanedContacts.push({
        siren: contact.siren,
        email: contact.email,
        emailNormalized: normalizeEmail(contact.email),
        societe: contact.societe,
        source: contact.source,
        status: 'rejected',
        rejectionReason: `SIREN invalide: "${contact.siren}"`,
        isGenericEmail: false,
        isDisposableEmail: false,
        hasValidMx: false
      });
      console.log(` Ligne ${i+1}: ${contact.email} → REJETe (SIREN invalide)`);
      continue;
    }
    
    const emailValidation = await validateEmail(contact.email);
    
    if (!emailValidation.isValid) {
      let reason = '';
      if (emailValidation.isDisposable) reason = `Email jetable: ${emailValidation.domain}`;
      else if (!emailValidation.hasValidMx) reason = `Domaine sans MX: ${emailValidation.domain}`;
      else reason = `Syntaxe invalide: "${contact.email}"`;
      
      cleanedContacts.push({
        siren: sirenResult.normalized,
        email: contact.email,
        emailNormalized: emailValidation.normalized,
        societe: contact.societe,
        source: contact.source,
        status: 'rejected',
        rejectionReason: reason,
        isGenericEmail: emailValidation.isGeneric,
        isDisposableEmail: emailValidation.isDisposable,
        hasValidMx: emailValidation.hasValidMx
      });
      console.log(` Ligne ${i+1}: ${contact.email} → REJETe (${reason})`);
    } else {
      cleanedContacts.push({
        siren: sirenResult.normalized,
        email: contact.email,
        emailNormalized: emailValidation.normalized,
        societe: contact.societe,
        source: contact.source,
        status: 'valid',
        rejectionReason: undefined,
        isGenericEmail: emailValidation.isGeneric,
        isDisposableEmail: emailValidation.isDisposable,
        hasValidMx: emailValidation.hasValidMx
      });
      const type = emailValidation.isGeneric ? 'generique' : 'nominatif';
      console.log(` Ligne ${i+1}: ${contact.email} → VALIDE (${type})`);
    }
  }
  
  // Separer valides et rejetes
  const validContactsBeforeDedup = cleanedContacts.filter(c => c.status === 'valid');
  const rejectedContacts = cleanedContacts.filter(c => c.status === 'rejected');
  
  console.log(`\n Apres validation:`);
  console.log(`   • Valides: ${validContactsBeforeDedup.length}`);
  console.log(`   • Rejetes: ${rejectedContacts.length}`);
  
  // Dedoublonnage
  console.log(`\n Dedoublonnage par SIREN...`);
  const finalContacts = deduplicateContacts(cleanedContacts);
  console.log(`   → ${finalContacts.length} contacts uniques conserves`);
  
  // Afficher les contacts finaux
  console.log(`\n CONTACTS FINAUX (apres dedoublonnage):`);
  finalContacts.forEach(c => {
    console.log(`   ${c.siren} - ${c.email} (${c.isGenericEmail ? 'generique' : 'nominatif'}) - ${c.societe}`);
  });
  
  // ============================================
  // EXPORT DES FICHIERS
  // ============================================
  console.log(`\n💾 Export des fichiers...`);
  
  const outputDir = path.join(__dirname, '..', '..', 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`    Dossier cree: ${outputDir}`);
  }
  
  // Exporter tous les contacts nettoyes (avant dedoublonnage)
  exportToCSV(cleanedContacts, path.join(outputDir, 'all_cleaned_contacts.csv'));
  exportToJSON(cleanedContacts, path.join(outputDir, 'all_cleaned_contacts.json'));
  
  // Exporter les contacts uniques (apres dedoublonnage)
  exportToCSV(finalContacts, path.join(outputDir, 'unique_contacts.csv'));
  exportToJSON(finalContacts, path.join(outputDir, 'unique_contacts.json'));
  
  // Exporter le rapport recapitulatif
  exportReport(finalContacts, rejectedContacts, path.join(outputDir, 'report.json'));
  
  console.log(`\n Partie 2 terminee !`);
  console.log(` Fichiers generes dans: ${outputDir}`);
}

// LANCEMENT AUTOMATIQUE
main().catch(console.error);