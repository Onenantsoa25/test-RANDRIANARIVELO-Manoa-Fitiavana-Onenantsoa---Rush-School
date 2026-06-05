// src/part2/csvReader.ts

import fs from 'fs';
import { parse } from 'csv-parse';
import { RawContact } from './types/index.js';

/**
 * Lit le fichier CSV et retourne un tableau de RawContact
 */
export async function readContactsFromCSV(filePath: string): Promise<RawContact[]> {
  return new Promise((resolve, reject) => {
    const contacts: RawContact[] = [];
    
    fs.createReadStream(filePath)
      .pipe(parse({
        columns: true,        // Utilise la premiere ligne comme en-tetes
        skip_empty_lines: true,
        trim: true
      }))
      .on('data', (row: any) => {
        contacts.push({
          siren: row.siren || '',
          email: row.email || '',
          societe: row.societe || '',
          source: row.source || ''
        });
      })
      .on('end', () => {
        console.log(` CSV lu: ${contacts.length} lignes chargees`);
        resolve(contacts);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}