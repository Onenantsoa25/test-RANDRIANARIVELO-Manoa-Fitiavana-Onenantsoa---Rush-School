// src/part3/types/index.ts

export type SendingStatus = 
  | 'new'           // Contact ajoute, pas encore traite
  | 'queued'        // En attente d'envoi (dans la file)
  | 'sending'       // En cours d'envoi (verrouille)
  | 'sent'          // Email envoye avec succes
  | 'replied'       // Reponse recue (arret des relances)
  | 'bounced'       // Email bounced (arret)
  | 'stopped'       // Arret manuel
  | 'failed';       // echec apres retry

export type BounceType = 'hard' | 'soft';

export interface Contact {
  id: number;
  siren: string;
  email: string;
  emailNormalized: string;
  societe: string;
  source: string;
  isGenericEmail: boolean;
  isDisposableEmail: boolean;
  hasValidMx: boolean;
}

export interface Sending {
  id: number;
  contactId: number;
  campaignId: number;
  status: SendingStatus;
  currentStep: number;  // 0 = initial, 1 = J+3, 2 = J+7
  step0SentAt: Date | null;
  step1SentAt: Date | null;
  step2SentAt: Date | null;
  repliedAt: Date | null;
  bouncedAt: Date | null;
  stoppedAt: Date | null;
  lastError: string | null;
  nextActionAt: Date | null;
  idempotencyKey: string;
}

export interface Reply {
  id: number;
  sendingId: number;
  messageId: string;
  fromEmail: string;
  subject: string;
  body: string;
  isBounce: boolean;
  bounceType: BounceType | null;
  receivedAt: Date;
}

export interface EmailToSend {
  to: string;
  subject: string;
  body: string;
  messageId: string;
  inReplyTo?: string;
  references?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}