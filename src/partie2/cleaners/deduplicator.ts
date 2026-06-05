// src/part2/cleaners/deduplicator.ts

import { CleanContact, DeduplicationResult } from '../types/index.js';

/**
 * Strategie de dedoublonnage :
 * 
 * La cle d'unicite est le **SIREN** (et non l'email)
 * Justification :
 * - Une entreprise (SIREN) peut avoir plusieurs emails valides
 * - Mais on veut une seule entree par entreprise dans notre base
 * - Quand plusieurs emails existent pour un meme SIREN, on garde le "meilleur" email
 * 
 * Regles de priorite pour choisir l'email a garder :
 * 1. Email nominatif (prenom.nom@) > email generique (contact@)
 * 2. Email avec MX valide > MX invalide
 * 3. Email non-jetable > jetable
 * 4. En dernier recours, on garde le premier rencontre
 */
export function deduplicateContacts(contacts: CleanContact[]): DeduplicationResult {
  const kept: CleanContact[] = [];
  const merged: { primary: CleanContact; duplicates: CleanContact[] }[] = [];
  
  // Grouper par SIREN (normalise)
  const groupsBySiren = new Map<string, CleanContact[]>();
  
  for (const contact of contacts) {
    // Ne garder que les contacts valides pour le dedoublonnage
    if (contact.status !== 'valid') continue;
    
    const key = contact.siren;
    if (!groupsBySiren.has(key)) {
      groupsBySiren.set(key, []);
    }
    groupsBySiren.get(key)!.push(contact);
  }
  
  // Pour chaque groupe (meme SIREN), choisir le meilleur contact
  for (const [siren, group] of groupsBySiren) {
    if (group.length === 1) {
      // Pas de doublon, on garde tel quel
      kept.push(group[0]);
    } else {
      // Doublon : choisir le meilleur email
      const best = selectBestContact(group);
      const duplicates = group.filter(c => c !== best);
      
      merged.push({
        primary: best,
        duplicates
      });
      
      kept.push(best);
    }
  }
  
  return { kept, merged };
}

/**
 * Score un contact pour determiner le "meilleur" email
 * Plus le score est eleve, meilleur est le contact
 */
function scoreContact(contact: CleanContact): number {
  let score = 0;
  
  // Email nominatif (prenom.nom@) = meilleur
  if (!contact.isGenericEmail) {
    score += 100;
  }
  
  // MX valide = essentiel
  if (contact.hasValidMx) {
    score += 50;
  }
  
  // Email non-jetable
  if (!contact.isDisposableEmail) {
    score += 30;
  }
  
  // Source IREME ou PAPPERS est plus fiable que scraping
  if (contact.source === 'irene' || contact.source === 'pappers') {
    score += 10;
  }
  
  return score;
}

/**
 * Selectionne le meilleur contact d'un groupe (meme SIREN)
 */
function selectBestContact(contacts: CleanContact[]): CleanContact {
  // Trier par score decroissant
  const sorted = [...contacts].sort((a, b) => scoreContact(b) - scoreContact(a));
  return sorted[0];
}

/**
 * Version alternative : garder TOUS les emails pour un meme SIREN
 * (utile si on veut pouvoir contacter plusieurs personnes dans la meme entreprise)
 * 
 * Cette approche n'est PAS utilisee par defaut car le sujet demande une cle d'unicite.
 */
export function keepAllEmailsPerSiren(contacts: CleanContact[]): CleanContact[] {
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
  for (const group of groupsBySiren.values()) {
    result.push(...group);
  }
  
  return result;
}