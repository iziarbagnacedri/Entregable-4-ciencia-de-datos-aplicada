import { handlePredictBatch, type ApiRequest, type ApiResponse } from '../../src/server/handlers.ts';

export default function handler(req: ApiRequest, res: ApiResponse) {
  return handlePredictBatch(req, res);
}
