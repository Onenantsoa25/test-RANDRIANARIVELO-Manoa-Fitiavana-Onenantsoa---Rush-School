// src/part3/models/sending.ts

import { pool } from '../db/pool.js';
import { Sending, SendingStatus } from '../types/index.js';

/**
 * Machine a etats des envois
 * 
 * Transitions autorisees :
 * new → queued → sending → sent → replied | bounced | stopped
 *                        → failed
 * sent → followup_1 (via timeout J+3)
 * followup_1 → followup_2 (via timeout J+7)
 */
export class SendingModel {
  
  /**
   * Cree un nouvel envoi pour un contact
   */
  static async create(contactId: number, campaignId: number): Promise<Sending> {
    const idempotencyKey = `${contactId}-${campaignId}-${Date.now()}`;
    
    const result = await pool.query(
      `INSERT INTO sendings (contact_id, campaign_id, status, current_step, idempotency_key, next_action_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [contactId, campaignId, 'new', 0, idempotencyKey, new Date()]
    );
    
    return result.rows[0];
  }
  
  /**
   * Recupere les envois qui doivent etre traites (pour le worker)
   * Utilise SELECT FOR UPDATE SKIP LOCKED pour l'idempotence
   */
  static async getPendingSendings(limit: number = 100): Promise<Sending[]> {
    const query = `
      SELECT s.*, c.email, c.societe, c.siren, c.is_generic_email
      FROM sendings s
      JOIN contacts c ON s.contact_id = c.id
      WHERE s.status IN ('queued', 'sent')
        AND s.next_action_at <= NOW()
        AND s.replied_at IS NULL
        AND s.bounced_at IS NULL
        AND s.stopped_at IS NULL
      ORDER BY s.next_action_at ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    `;
    
    const result = await pool.query(query, [limit]);
    return result.rows;
  }
  
  /**
   * Passe un envoi en statut "sending" (verrouille)
   * Retourne false si deja verrouille par un autre worker
   */
  static async lockForSending(id: number): Promise<boolean> {
    const result = await pool.query(
      `UPDATE sendings 
       SET status = 'sending', updated_at = NOW()
       WHERE id = $1 AND status IN ('queued', 'sent')
       RETURNING id`,
      [id]
    );
    
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  /**
   * Marque un envoi comme reussi (email envoye)
   * @param step 0 = initial, 1 = followup_1, 2 = followup_2
   */
  static async markAsSent(id: number, step: number): Promise<void> {
    const stepField = step === 0 ? 'step_0_sent_at' : step === 1 ? 'step_1_sent_at' : 'step_2_sent_at';
    const nextActionAt = this.computeNextActionDate(step);
    const newStatus = step === 2 ? 'sent' : 'queued';  // Derniere relance → reste en 'sent'
    
    await pool.query(
      `UPDATE sendings 
       SET status = $1, 
           current_step = $2,
           ${stepField} = NOW(),
           next_action_at = $3,
           last_error = NULL,
           updated_at = NOW()
       WHERE id = $4`,
      [newStatus, step + 1, nextActionAt, id]
    );
  }
  
  /**
   * Calcule la date de la prochaine action (J+3 ou J+7)
   */
  static computeNextActionDate(step: number): Date | null {
    const now = new Date();
    
    if (step === 0) {
      // Premier email envoye, prochaine relance J+3
      const next = new Date(now);
      next.setDate(now.getDate() + 3);
      return next;
    } else if (step === 1) {
      // Relance J+3 envoyee, prochaine relance J+7
      const next = new Date(now);
      next.setDate(now.getDate() + 4); // J+3 + 4 = J+7
      return next;
    } else {
      // Derniere relance, plus de prochaine action
      return null;
    }
  }
  
  /**
   * Marque un envoi comme echoue
   */
  static async markAsFailed(id: number, error: string): Promise<void> {
    await pool.query(
      `UPDATE sendings 
       SET status = 'failed', 
           last_error = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [error, id]
    );
  }
  
  /**
   * Marque un envoi comme ayant recu une reponse
   * Arrete toutes les relances futures
   */
  static async markAsReplied(id: number, messageId: string): Promise<void> {
    await pool.query(
      `UPDATE sendings 
       SET status = 'replied', 
           replied_at = NOW(),
           next_action_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }
  
  /**
   * Marque un envoi comme bounced
   * @param type 'hard' (arret definitif) ou 'soft' (on peut reessayer)
   */
  static async markAsBounced(id: number, type: 'hard' | 'soft'): Promise<void> {
    const newStatus = type === 'hard' ? 'bounced' : 'queued';
    const nextActionAt = type === 'soft' 
      ? new Date(Date.now() + 3600000) // Soft bounce : reessayer dans 1h
      : null;
    
    await pool.query(
      `UPDATE sendings 
       SET status = $1, 
           bounced_at = NOW(),
           next_action_at = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [newStatus, nextActionAt, id]
    );
  }
  
  /**
   * Verifie si une reponse a deja ete recue (pour eviter la course critique)
   */
  static async hasReply(id: number): Promise<boolean> {
    const result = await pool.query(
      `SELECT replied_at FROM sendings WHERE id = $1 AND replied_at IS NOT NULL`,
      [id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  /**
   * Verifie si un envoi a deja ete traite (idempotence)
   */
  static async isAlreadyProcessed(idempotencyKey: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT id FROM sendings WHERE idempotency_key = $1 AND status != 'new'`,
      [idempotencyKey]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  /**
   * Recupere les statistiques
   */
  static async getStats(): Promise<any> {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) as replied,
        SUM(CASE WHEN status = 'bounced' THEN 1 ELSE 0 END) as bounced,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        AVG(CASE WHEN replied_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (replied_at - step_0_sent_at)) / 3600 
            ELSE NULL END) as avg_reply_hours
      FROM sendings
    `);
    return result.rows[0];
  }
}