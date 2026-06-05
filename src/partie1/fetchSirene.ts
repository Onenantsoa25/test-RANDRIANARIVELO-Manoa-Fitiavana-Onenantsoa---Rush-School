// src/partie1/fetchSirene.ts

import { callSireneApi } from './mockApi.js';
import { RateLimiter } from './rateLimiter.js';
import { ApiError, FetchSireneOptions, UniteLegale } from './types.js';

const DEFAULT_MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000; // 1 seconde

/**
 * Calcule le delai d'attente avec backoff exponentiel + jitter
 * @param attempt - Numero de la tentative (0-index)
 * @param retryAfter - Valeur de l'en-tete Retry-After (secondes)
 * @returns Delai en millisecondes
 */
function computeBackoffDelay(attempt: number, retryAfter: number | null = null): number {
  if (retryAfter !== null) {
    // Retry-After prime sur tout (en secondes)
    return retryAfter * 1000;
  }
  
  // Backoff exponentiel : 1s, 2s, 4s, 8s, 16s...
  const exponentialDelay = BASE_DELAY_MS * Math.pow(2, attempt);
  
  // Jitter : ajoute entre 0 et 30% de delai supplementaire
  // evite que tous les clients reessayent exactement en meme temps (effet de meute)
  const jitter = exponentialDelay * (Math.random() * 0.3);
  
  return exponentialDelay + jitter;
}

/**
 * Verifie si une erreur est transitoire (on peut reessayer)
 * @param error - L'erreur a verifier
 * @returns true si l'erreur est transitoire
 */
function isTransientError(error: ApiError): boolean {
  const status = error.response?.status;
  
  // 429 = Too Many Requests → transitoire
  // 5xx = Erreur serveur → transitoire
  if (status === 429 || (status !== undefined && status >= 500 && status < 600)) {
    return true;
  }
  
  // 404 = Not Found → definitif (le SIREN n'existe pas)
  // 400 = Bad Request → definitif (SIREN mal forme)
  // 401/403 = Auth → definitif
  return false;
}

/**
 * Recupere l'en-tete Retry-After d'une erreur
 * @param error - L'erreur contenant potentiellement l'en-tete
 * @returns Secondes a attendre, ou null si absent
 */
function getRetryAfter(error: ApiError): number | null {
  const retryAfter = error.response?.headers?.['retry-after'] ||
                     error.response?.headers?.['Retry-After'];
  
  if (!retryAfter) return null;
  
  // Peut etre un nombre (secondes) ou une date HTTP (ex: Wed, 21 Oct 2015 07:28:00 GMT)
  const parsed = parseInt(retryAfter, 10);
  if (!isNaN(parsed)) return parsed;
  
  // Si c'est une date, calculer les secondes jusqu'a cette date
  const date = new Date(retryAfter);
  if (!isNaN(date.getTime())) {
    const seconds = Math.ceil((date.getTime() - Date.now()) / 1000);
    return Math.max(0, seconds);
  }
  
  return null;
}

/**
 * Recupere TOUTES les pages de donnees pour un SIREN donne
 * @param siren - SIREN a 9 chiffres
 * @param options - Options (maxRetries, rateLimiter, verbose)
 * @returns Toutes les unites legales trouvees
 */
export async function fetchSireneData(
  siren: string, 
  options: FetchSireneOptions = {}
): Promise<UniteLegale[]> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    rateLimiter = new RateLimiter(),
    verbose = true
  } = options;
  
  const allUnitesLegales: UniteLegale[] = [];
  let currentPage = 1;
  let totalPages: number | null = null;
  
  if (verbose) {
    console.log(`\n Debut recuperation pour SIREN ${siren}`);
  }
  
  // Boucle sur les pages
  while (totalPages === null || currentPage <= totalPages) {
    let lastError: ApiError | null = null;
    let success = false;
    
    // Tentatives pour une page donnee
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // 1. Respecter le rate limiter global AVANT l'appel
        await rateLimiter.wait();
        
        if (verbose) {
          console.log(` Page ${currentPage} - tentative ${attempt + 1}/${maxRetries}...`);
        }
        
        // 2. Appel API
        const response = await callSireneApi(siren, currentPage);
        
        // 3. Recuperer les donnees de cette page
        if (response.data?.uniteLegale) {
          allUnitesLegales.push(response.data.uniteLegale);
          if (verbose) {
            console.log(`      Unite legale recuperee: ${response.data.uniteLegale.denomination}`);
          }
        }
        
        // 4. Recuperer les etablissements si presents
        if (response.data?.etablissements && response.data.etablissements.length > 0) {
          if (verbose) {
            console.log(` ${response.data.etablissements.length} etablissement(s) trouve(s)`);
          }
        }
        
        // 5. Gerer la pagination
        if (totalPages === null && response.pagination?.totalPages) {
          totalPages = response.pagination.totalPages;
          if (verbose) {
            console.log(`      Total des pages: ${totalPages}`);
          }
        }
        
        success = true;
        break; // Sortir de la boucle de retry
        
      } catch (error) {
        lastError = error as ApiError;
        
        // Verifier si l'erreur est transitoire
        if (!isTransientError(lastError)) {
          // Erreur definitive : on arrete immediatement
          throw new Error(`Erreur definitive pour SIREN ${siren} page ${currentPage}: ${lastError.message}`);
        }
        
        // Erreur transitoire : on attend puis on reessaie
        const retryAfter = getRetryAfter(lastError);
        const delayMs = computeBackoffDelay(attempt, retryAfter);
        
        console.warn(`SIREN ${siren} page ${currentPage}: tentative ${attempt + 1}/${maxRetries} echouee. ` +
                    `Attente ${Math.round(delayMs)}ms avant reessai. Erreur: ${lastError.message}`);
        
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    if (!success) {
      // Toutes les tentatives ont echoue
      throw new Error(`echec apres ${maxRetries} tentatives pour SIREN ${siren} page ${currentPage}: ${lastError?.message}`);
    }
    
    currentPage++;
  }
  
  if (verbose) {
    console.log(`   Termine: ${allUnitesLegales.length} unite(s) legale(s) trouvee(s) pour ${siren}`);
  }
  
  return allUnitesLegales;
}

/**
 * Version simplifiee : ne retourne que la premiere unite legale (cas le plus courant)
 */
export async function fetchFirstSireneData(
  siren: string, 
  options: FetchSireneOptions = {}
): Promise<UniteLegale | null> {
  const results = await fetchSireneData(siren, options);
  return results[0] || null;
}