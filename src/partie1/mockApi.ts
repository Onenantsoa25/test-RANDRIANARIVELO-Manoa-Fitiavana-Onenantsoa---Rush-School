// src/part1/mockApi.ts

import { SireneResponse, ApiError, UniteLegale, Etablissement } from './types.js';

interface MockData {
  denomination: string;
  etatAdministratif: string;
  totalPages: number;
  etablissements: Record<number, Etablissement[]>;
}

const mockData: Record<string, MockData> = {
  '552081317': {
    denomination: 'ACME Conseil',
    etatAdministratif: 'Actif',
    totalPages: 2,
    etablissements: {
      1: [
        { siret: '55208131700012', denomination: 'ACME Conseil Siege', etatAdministratif: 'Actif' },
        { siret: '55208131700020', denomination: 'ACME Conseil Paris', etatAdministratif: 'Actif' }
      ],
      2: [
        { siret: '55208131700038', denomination: 'ACME Conseil Lyon', etatAdministratif: 'Actif' },
        { siret: '55208131700046', denomination: 'ACME Conseil Marseille', etatAdministratif: 'Ferme' }
      ]
    }
  },
  '443061841': {
    denomination: 'FormaPro',
    etatAdministratif: 'Actif',
    totalPages: 3,
    etablissements: {
      1: [{ siret: '44306184100015', denomination: 'FormaPro Bordeaux', etatAdministratif: 'Actif' }],
      2: [
        { siret: '44306184100023', denomination: 'FormaPro Toulouse', etatAdministratif: 'Actif' },
        { siret: '44306184100031', denomination: 'FormaPro Nantes', etatAdministratif: 'Actif' }
      ],
      3: [
        { siret: '44306184100049', denomination: 'FormaPro Lille', etatAdministratif: 'Ferme' },
        { siret: '44306184100056', denomination: 'FormaPro Strasbourg', etatAdministratif: 'Actif' }
      ]
    }
  },
  '812998002': {
    denomination: 'BTP Solutions',
    etatAdministratif: 'Ferme',
    totalPages: 1,
    etablissements: {
      1: [{ siret: '81299800200099', denomination: 'BTP Solutions', etatAdministratif: 'Ferme' }]
    }
  },
  '327911044': {
    denomination: 'Quick Win',
    etatAdministratif: 'Actif',
    totalPages: 1,
    etablissements: {
      1: [{ siret: '32791104400022', denomination: 'Quick Win', etatAdministratif: 'Actif' }]
    }
  }
};

/**
 * Mock ou vraie API Sirene.
 * En production, remplacer par un vrai appel axios vers l'API INSEE.
 */
export async function callSireneApi(siren: string, page: number = 1): Promise<SireneResponse> {
  // Simuler des comportements pour tester le backoff
  const random = Math.random();
  
  // Simuler une erreur 429 (rate limit) 20% du temps
  if (random < 0.2) {
    const error = new Error('Rate limit exceeded') as ApiError;
    error.response = { status: 429, headers: { 'retry-after': '2' } };
    throw error;
  }
  
  // Simuler une erreur 5xx 10% du temps
  if (random < 0.3 && random >= 0.2) {
    const error = new Error('Internal server error') as ApiError;
    error.response = { status: 500 };
    throw error;
  }
  
  const data = mockData[siren];
  
  if (!data) {
    const error = new Error('SIREN not found') as ApiError;
    error.response = { status: 404 };
    throw error;
  }
  
  // Verifier si la page demandee existe
  if (page > data.totalPages) {
    return {
      data: {
        uniteLegale: {
          denomination: data.denomination,
          etatAdministratif: data.etatAdministratif
        },
        etablissements: []
      },
      pagination: {
        page: page,
        totalPages: data.totalPages,
        hasNext: false
      }
    };
  }
  
  // Recuperer les etablissements de la page demandee
  const etablissements = data.etablissements[page] || [];
  
  return {
    data: {
      uniteLegale: {
        denomination: data.denomination,
        etatAdministratif: data.etatAdministratif
      },
      etablissements: etablissements
    },
    pagination: {
      page: page,
      totalPages: data.totalPages,
      hasNext: page < data.totalPages,
      totalEtablissements: Object.values(data.etablissements).flat().length
    }
  };
}