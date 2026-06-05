// src/part2/csvWriter.ts

import fs from 'fs';
import { ValidationReport, CleanContact } from './types/index.js';

/**
 * Exporte le rapport de validation en CSV
 */
export function exportReportToCSV(
  report: ValidationReport,
  outputPath: string
): void {
  const headers = [
    'rowIndex',
    'action',
    'siren_original',
    'email_original',
    'societe',
    'source',
    'reason',
    'merged_into_row'
  ];
  
  const rows = report.details.map(detail => [
    detail.rowIndex,
    detail.action,
    detail.originalData.siren,
    detail.originalData.email,
    detail.originalData.societe,
    detail.originalData.source,
    detail.reason || '',
    detail.mergedInto || ''
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  fs.writeFileSync(outputPath, csvContent, 'utf-8');
  console.log(` Rapport exporte: ${outputPath}`);
}

/**
 * Exporte les contacts nettoyes en CSV
 */
export function exportCleanContactsToCSV(
  contacts: CleanContact[],
  outputPath: string
): void {
  const headers = [
    'siren',
    'email',
    'email_normalized',
    'societe',
    'source',
    'status',
    'rejection_reason',
    'is_generic_email',
    'is_disposable_email',
    'has_valid_mx'
  ];
  
  const rows = contacts.map(contact => [
    contact.siren,
    contact.email,
    contact.emailNormalized,
    contact.societe,
    contact.source,
    contact.status,
    contact.rejectionReason || '',
    contact.isGenericEmail,
    contact.isDisposableEmail,
    contact.hasValidMx
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  fs.writeFileSync(outputPath, csvContent, 'utf-8');
  console.log(` Contacts nettoyes exportes: ${outputPath}`);
}

/**
 * Exporte les statistiques en JSON
 */
export function exportStatsToJSON(
  report: ValidationReport,
  outputPath: string
): void {
  const stats = {
    totalInput: report.totalInput,
    kept: report.kept,
    rejected: report.rejected,
    rejectionBreakdown: report.rejectionBreakdown,
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(stats, null, 2), 'utf-8');
  console.log(` Statistiques exportees: ${outputPath}`);
}