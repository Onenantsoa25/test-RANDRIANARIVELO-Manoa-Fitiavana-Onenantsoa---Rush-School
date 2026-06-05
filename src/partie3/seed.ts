// src/partie3/seed.ts

import { pool } from './db/pool.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seedContacts() {
  console.log('📥 Import des contacts depuis la Partie 2...');
  
  // Essayer plusieurs chemins possibles
  const possiblePaths = [
    path.join(__dirname, '..', '..', 'output', 'unique_contacts.json'),
    path.join(__dirname, '..', '..', '..', 'output', 'unique_contacts.json'),
    path.join(process.cwd(), 'output', 'unique_contacts.json')
  ];
  
  let outputPath = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      outputPath = p;
      break;
    }
  }
  
  if (!outputPath) {
    console.error(` Fichier unique_contacts.json non trouve`);
    console.log('   Chemins recherches:');
    possiblePaths.forEach(p => console.log(`   - ${p}`));
    console.log('\n   Execute d\'abord la Partie 2 pour generer les contacts.');
    process.exit(1);
  }
  
  console.log(` Fichier trouve: ${outputPath}`);
  
  const contacts = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
  console.log(` ${contacts.length} contacts a importer`);
  
  let imported = 0;
  let existing = 0;
  
  for (const contact of contacts) {
    const existingContact = await pool.query(
      'SELECT id FROM contacts WHERE email = $1',
      [contact.email]
    );
    
    if (existingContact.rows.length === 0) {
      await pool.query(
        `INSERT INTO contacts (siren, email, email_normalized, societe, source, is_generic_email, is_disposable_email, has_valid_mx)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          contact.siren,
          contact.email,
          contact.emailNormalized,
          contact.societe,
          contact.source,
          contact.isGenericEmail || false,
          contact.isDisposableEmail || false,
          contact.hasValidMx !== undefined ? contact.hasValidMx : true
        ]
      );
      imported++;
      console.log(`    Importe: ${contact.email}`);
    } else {
      existing++;
      console.log(` Deja existant: ${contact.email}`);
    }
  }
  
  console.log(`\n Import termine: ${imported} nouveaux, ${existing} existants`);
  process.exit(0);
}

seedContacts().catch(console.error);