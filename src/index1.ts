// src/index.ts

import dotenv from 'dotenv';
import { fetchFirstSireneData } from './partie1/fetchSirene.js';
import { RateLimiter } from './partie1/rateLimiter.js';

dotenv.config();

async function main(): Promise<void> {
  console.log('=== Test Partie 1 ===\n');
  
  // Creer un rate limiter global (5 requetes/seconde par defaut)
  const rateLimiter = new RateLimiter(
    parseInt(process.env.RATE_LIMIT_REQUESTS_PER_SECOND || '5', 10)
  );
  
  // Tester plusieurs SIREN
  const sirens: string[] = ['552081317', '443061841', '812998002', '999999999'];
  
  for (const siren of sirens) {
    console.log(`\n--- Traitement SIREN: ${siren} ---`);
    
    try {
      const data = await fetchFirstSireneData(siren, {
        maxRetries: parseInt(process.env.MAX_RETRIES || '5', 10),
        rateLimiter,
        verbose: true
      });
      
      if (data) {
        console.log(` Succes:`);
        console.log(`   Denomination: ${data.denomination}`);
        console.log(`   etat: ${data.etatAdministratif}`);
      } else {
        console.log(` Aucune donnee trouvee`);
      }
    } catch (error) {
      console.error(` Erreur: ${(error as Error).message}`);
    }
  }
}

main();