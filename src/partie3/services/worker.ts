// src/part3/services/worker.ts

import { SendingModel } from '../models/sending.js';
import { EmailSender } from './emailSender.js';

/**
 * Worker planifie qui s'execute toutes les X minutes
 * 
 * Responsabilites :
 * 1. Recuperer les envois en attente (avec FOR UPDATE SKIP LOCKED)
 * 2. Verifier qu'aucune reponse n'est arrivee entre-temps (course critique)
 * 3. Envoyer l'email
 * 4. Mettre a jour le statut
 * 5. Gerer les bounces
 */
export class Worker {
  private isRunning: boolean = false;
  private intervalMs: number;
  private intervalId: NodeJS.Timeout | null = null;
  
  constructor(intervalMs: number = 300000) { // 5 minutes par defaut
    this.intervalMs = intervalMs;
  }
  
  /**
   * Demarre le worker (planification toutes les X minutes)
   */
  start(): void {
    if (this.intervalId) {
      console.log(' Worker deja en cours d\'execution');
      return;
    }
    
    console.log(` Worker demarre (intervalle: ${this.intervalMs / 1000} secondes)`);
    
    // Execution immediate au demarrage
    this.runOnce();
    
    // Puis planification
    this.intervalId = setInterval(() => {
      this.runOnce();
    }, this.intervalMs);
  }
  
  /**
   * Arrete le worker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log(' Worker arrete');
    }
  }
  
  /**
   * Execute un cycle du worker
   */
  private async runOnce(): Promise<void> {
    if (this.isRunning) {
      console.log(' Cycle precedent encore en cours, skip...');
      return;
    }
    
    this.isRunning = true;
    
    try {
      console.log(`\n [${new Date().toISOString()}] Debut du cycle worker`);
      
      // 1. Recuperer les envois en attente
      const pendingSendings = await SendingModel.getPendingSendings(50);
      
      if (pendingSendings.length === 0) {
        console.log('   Aucun envoi en attente');
        return;
      }
      
      console.log(`    ${pendingSendings.length} envoi(s) a traiter`);
      
      // 2. Traiter chaque envoi
      for (const sending of pendingSendings) {
        await this.processSending(sending);
      }
      
      // 3. Afficher les stats
      const stats = await SendingModel.getStats();
      console.log(`Stats: ${stats.sent} envoyes, ${stats.replied} reponses, ${stats.bounced} bounces`);
      
    } catch (error) {
      console.error(' Erreur dans le worker:', error);
    } finally {
      this.isRunning = false;
    }
  }
  
  /**
   * Traite un envoi specifique
   */
  private async processSending(sending: any): Promise<void> {
    console.log(`\n Traitement envoi #${sending.id} (${sending.email})`);
    
    // === COURSE CRITIQUE ===
    // Verifier qu'une reponse n'est pas arrivee ENTRE la selection et maintenant
    const hasReply = await SendingModel.hasReply(sending.id);
    if (hasReply) {
      console.log(` Course critique evitee: une reponse est arrivee, on annule l'envoi`);
      return;
    }
    
    // === VERROUILLAGE (IDEMPOTENCE) ===
    // Passer le statut a "sending" pour verrouiller
    const locked = await SendingModel.lockForSending(sending.id);
    if (!locked) {
      console.log(` Deja verrouille par un autre worker, skip`);
      return;
    }
    
    try {
      // Determiner l'etape (0, 1 ou 2)
      const step = sending.current_step;
      const stepNames = ['initial', 'relance J+3', 'relance J+7'];
      console.log(`       etape: ${stepNames[step] || step}`);
      
      // Preparer l'email
      const email = EmailSender.prepareEmail(sending, step);
      
      // Envoyer l'email
      const result = await EmailSender.send(email);
      
      if (result.success) {
        // Detecter si c'est un bounce (simule dans le mock)
        if (result.error === 'bounce_hard') {
          console.log(`       Hard bounce detecte`);
          await SendingModel.markAsBounced(sending.id, 'hard');
        } else {
          // Succes : mettre a jour le statut
          await SendingModel.markAsSent(sending.id, step);
          console.log(` Email envoye avec succes (${stepNames[step]})`);
          
          if (step === 2) {
            console.log(` Derniere relance envoyee, plus de follow-up`);
          } else {
            const nextDate = SendingModel.computeNextActionDate(step);
            console.log(`Prochaine action: ${nextDate?.toISOString() || 'aucune'}`);
          }
        }
      } else {
        // echec d'envoi
        console.log(`       echec d'envoi: ${result.error}`);
        await SendingModel.markAsFailed(sending.id, result.error || 'Unknown error');
      }
      
    } catch (error) {
      console.error(`       Exception:`, error);
      await SendingModel.markAsFailed(sending.id, String(error));
    }
  }
}