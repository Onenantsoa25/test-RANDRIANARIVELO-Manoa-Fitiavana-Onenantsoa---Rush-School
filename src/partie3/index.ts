// src/partie3/index.ts

import { pool } from './db/pool.js';
import { Worker } from './services/worker.js';
import { SendingModel } from './models/sending.js';

/**
 * Initialise la Partie 3
 */
async function initPart3() {
  console.log('\n PARTIE 3 : MOTEUR D\'ENVOI & RELANCE\n');
  
  try {
    // 1. Verifier qu'il y a des contacts dans la base
    const contactsResult = await pool.query('SELECT COUNT(*) as count FROM contacts');
    const contactCount = parseInt(contactsResult.rows[0]?.count || '0');
    
    if (contactCount === 0) {
      console.log(' Aucun contact trouve dans la base.');
      console.log('Il faut d\'abord importer les contacts depuis la Partie 2.');
      console.log('Execute d\'abord le script d\'import:');
      console.log('npx tsx src/partie3/seed.ts\n');
      return;
    }
    
    console.log(` ${contactCount} contacts trouves dans la base`);
    
    // 2. Verifier si la campagne existe, la creer si necessaire
    let campaignId: number;
    const campaignName = 'Campagne Prospection Mai 2026';
    
    const existingCampaign = await pool.query(
      'SELECT id FROM campaigns WHERE name = $1',
      [campaignName]
    );
    
    if (existingCampaign.rows.length > 0) {
      campaignId = existingCampaign.rows[0].id;
      console.log(` Campagne existante: ${campaignName} (ID ${campaignId})`);
    } else {
      const newCampaign = await pool.query(
        'INSERT INTO campaigns (name, status) VALUES ($1, $2) RETURNING id',
        [campaignName, 'active']
      );
      campaignId = newCampaign.rows[0].id;
      console.log(` Nouvelle campagne creee: ${campaignName} (ID ${campaignId})`);
    }
    
    // 3. Creer les envois pour les contacts qui n'en ont pas deja
    // Version corrigee : generer l'idempotency_key en JavaScript plutôt qu'en SQL
    const contactsToProcess = await pool.query(
      `SELECT c.id 
       FROM contacts c 
       WHERE NOT EXISTS (
         SELECT 1 FROM sendings s WHERE s.contact_id = c.id AND s.campaign_id = $1
       )`,
      [campaignId]
    );
    
    let createdCount = 0;
    const now = new Date();
    const epochSeconds = Math.floor(now.getTime() / 1000);
    
    for (const contact of contactsToProcess.rows) {
      const idempotencyKey = `${contact.id}-${campaignId}-${epochSeconds}`;
      
      await pool.query(
        `INSERT INTO sendings (contact_id, campaign_id, status, current_step, idempotency_key, next_action_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [contact.id, campaignId, 'queued', 0, idempotencyKey, now]
      );
      createdCount++;
    }
    
    console.log(` ${createdCount} nouvel(s) envoi(s) cree(s)`);
    
    // 4. Compter les envois en attente
    const pendingResult = await pool.query(`
      SELECT COUNT(*) as count FROM sendings 
      WHERE campaign_id = $1 AND status IN ('queued', 'sent') AND replied_at IS NULL
    `, [campaignId]);
    
    console.log(` ${pendingResult.rows[0].count} envoi(s) en attente de traitement`);
    
    // 5. Demarrer le worker
    const workerInterval = parseInt(process.env.WORKER_INTERVAL_MS || '30000'); // 30 secondes pour le test
    const worker = new Worker(workerInterval);
    worker.start();
    
    // 6. Afficher les stats periodiquement
    const statsInterval = setInterval(async () => {
      try {
        const stats = await SendingModel.getStats();
        console.log(`\n STATS: envoyes=${stats.sent || 0}, reponses=${stats.replied || 0}, bounces=${stats.bounced || 0}, echecs=${stats.failed || 0}`);
      } catch (err) {
        console.error('Erreur stats:', err);
      }
    }, 10000);
    
    // 7. Gestion de l'arret propre
    process.on('SIGINT', () => {
      console.log('\n Arret demande...');
      worker.stop();
      clearInterval(statsInterval);
      pool.end();
      console.log(' Nettoyage termine');
      process.exit(0);
    });
    
    console.log('\n Partie 3 initialisee !');
    console.log('   Le worker tourne et va envoyer les emails (toutes les 30 secondes).');
    console.log('   Appuie sur Ctrl+C pour arreter.\n');
    
  } catch (error) {
    console.error(' Erreur d\'initialisation:', error);
  }
}

// Execution
initPart3().catch(console.error);