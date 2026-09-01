import { Router } from 'express';
import { getEcwidClientId } from '../../lib/config.js';
import { corsHeaders, jsonResponse } from '../../lib/api-response.js';

export const storefrontConfigRouter = Router();

storefrontConfigRouter.options('/', (req, res) => {
  res.status(204).set(corsHeaders(req)).end();
});

storefrontConfigRouter.get('/', (req, res) => {
  jsonResponse(res, req, { clientId: getEcwidClientId() });
});
