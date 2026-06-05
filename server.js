const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Importer tes fonctions de la Partie 1
const { fetchSireneData, fetchFirstSireneData } = require('./partie1/fetchSiren');
const RateLimiter = require('./partie1/rateLimiter');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Creer un rate limiter global reutilisable
const globalRateLimiter = new RateLimiter(
  parseInt(process.env.RATE_LIMIT_REQUESTS_PER_SECOND || '5', 10)
);

/**
 * Endpoint 1: Recuperer toutes les pages pour un SIREN
 * GET /api/siren/:siren?allPages=true
 */
app.get('/api/siren/:siren', async (req, res) => {
  const { siren } = req.params;
  const { allPages } = req.query;
  
  // Validation basique
  if (!siren || !/^\d{9}$/.test(siren)) {
    return res.status(400).json({
      error: 'SIREN invalide. Doit etre 9 chiffres.',
      example: '/api/siren/552081317'
    });
  }
  
  try {
    console.log(`📡 Appel API pour SIREN: ${siren}`);
    
    let result;
    if (allPages === 'true') {
      // Recupere TOUTES les pages
      result = await fetchSireneData(siren, {
        maxRetries: parseInt(process.env.MAX_RETRIES || '5', 10),
        rateLimiter: globalRateLimiter
      });
    } else {
      // Recupere seulement la premiere unite legale
      result = await fetchFirstSireneData(siren, {
        maxRetries: parseInt(process.env.MAX_RETRIES || '5', 10),
        rateLimiter: globalRateLimiter
      });
    }
    
    if (!result || (Array.isArray(result) && result.length === 0)) {
      return res.status(404).json({
        success: false,
        message: 'Aucune donnee trouvee pour ce SIREN',
        siren
      });
    }
    
    res.json({
      success: true,
      siren,
      data: result,
      total: Array.isArray(result) ? result.length : 1
    });
    
  } catch (error) {
    console.error(` Erreur pour SIREN ${siren}:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      siren
    });
  }
});

/**
 * Endpoint 2: Traiter plusieurs SIREN en parallele (batch)
 * POST /api/siren/batch
 * Body: { "sirens": ["552081317", "443061841"] }
 */
app.post('/api/siren/batch', async (req, res) => {
  const { sirens } = req.body;
  
  if (!sirens || !Array.isArray(sirens)) {
    return res.status(400).json({
      error: 'Format invalide. Envoyer { "sirens": ["123456789", ...] }'
    });
  }
  
  const results = [];
  
  for (const siren of sirens) {
    try {
      const data = await fetchFirstSireneData(siren, {
        maxRetries: parseInt(process.env.MAX_RETRIES || '5', 10),
        rateLimiter: globalRateLimiter
      });
      
      results.push({
        siren,
        success: true,
        data
      });
    } catch (error) {
      results.push({
        siren,
        success: false,
        error: error.message
      });
    }
  }
  
  res.json({
    total: sirens.length,
    results
  });
});

/**
 * Endpoint 3: Health check
 * GET /health
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    rateLimiter: `${process.env.RATE_LIMIT_REQUESTS_PER_SECOND || 5} req/s`
  });
});

// Demarrer le serveur
app.listen(PORT, () => {
  console.log(` Serveur lance sur http://localhost:${PORT}`);
  console.log(`\n📌 Endpoints disponibles:`);
  console.log(`   GET  /health                    - Verifier l'etat`);
  console.log(`   GET  /api/siren/:siren          - Un seul SIREN`);
  console.log(`   GET  /api/siren/:siren?allPages=true - Toutes les pages`);
  console.log(`   POST /api/siren/batch           - Plusieurs SIREN`);
  console.log(`\n Exemples:`);
  console.log(`   curl http://localhost:${PORT}/api/siren/552081317`);
  console.log(`   curl -X POST http://localhost:${PORT}/api/siren/batch \\`);
  console.log(`        -H "Content-Type: application/json" \\`);
  console.log(`        -d '{"sirens":["552081317","443061841"]}'`);
});