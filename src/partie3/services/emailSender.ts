// src/part3/services/emailSender.ts

import { EmailToSend, SendResult } from '../types/index.js';
import crypto from 'crypto';

/**
 * Service d'envoi d'emails
 * En production : utiliser nodemailer avec SMTP
 * Ici : version mockee pour les tests
 */
export class EmailSender {
  
  /**
   * Genere un Message-ID unique pour l'email
   */
  static generateMessageId(email: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const domain = email.split('@')[1] || 'prospection.local';
    return `<${timestamp}.${random}@${domain}>`;
  }
  
  /**
   * Prepare l'email a envoyer
   */
  static prepareEmail(contact: any, step: number): EmailToSend {
    const messageId = this.generateMessageId(contact.email);
    
    const subjects = [
      `Decouvrez nos solutions pour ${contact.societe}`,
      `Relance : Suite a notre precedent email`,
      `Derniere relance : Opportunite pour ${contact.societe}`
    ];
    
    const bodies = [
      `Bonjour,\n\nNous aimerions vous presenter nos solutions...`,
      `Bonjour,\n\nSuite a notre precedent email, avez-vous eu l'occasion...`,
      `Bonjour,\n\nCeci est notre derniere relance concernant...`
    ];
    
    return {
      to: contact.email,
      subject: subjects[step],
      body: bodies[step],
      messageId: messageId
    };
  }
  
  /**
   * Envoie l'email (version mockee)
   * En production : remplacer par nodemailer
   */
  static async send(email: EmailToSend): Promise<SendResult> {
    // Mock : simuler un delai d'envoi
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simuler 5% d'echec aleatoire pour tester les retries
    const random = Math.random();
    if (random < 0.05) {
      return {
        success: false,
        error: 'SMTP connection timeout'
      };
    }
    
    // Simuler 2% de bounce hard
    if (random < 0.07 && random >= 0.05) {
      return {
        success: true,
        messageId: email.messageId,
        error: 'bounce_hard'  // On va detecter ca dans le worker
      };
    }
    
    console.log(`Email envoye a ${email.to}: "${email.subject}"`);
    console.log(`Message-ID: ${email.messageId}`);
    
    return {
      success: true,
      messageId: email.messageId
    };
  }
  
  /**
   * Verifie si l'email est un bounce
   * (a utiliser apres reception du rapport de bounce)
   */
  static isHardBounce(error: string): boolean {
    const hardBouncePatterns = [
      'user unknown',
      'no such user',
      'mailbox unavailable',
      'recipient rejected',
      'invalid recipient'
    ];
    
    return hardBouncePatterns.some(pattern => 
      error.toLowerCase().includes(pattern)
    );
  }
}