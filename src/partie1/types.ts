export interface ApiError extends Error {
  response?: {
    status: number;
    headers?: Record<string, string>;
  };
}

export interface UniteLegale {
  denomination: string;
  etatAdministratif: string;
}

export interface Etablissement {
  siret: string;
  denomination: string;
  etatAdministratif: string;
}

export interface SireneResponse {
  data: {
    uniteLegale?: UniteLegale;
    etablissements?: Etablissement[];
  };
  pagination: {
    page: number;
    totalPages: number;
    hasNext?: boolean;
    totalEtablissements?: number;
  };
}

export interface FetchSireneOptions {
  maxRetries?: number;
  rateLimiter?: any;
  verbose?: boolean;
}