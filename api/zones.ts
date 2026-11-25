import { handleZones, type ApiRequest, type ApiResponse } from '../src/server/handlers.ts';

export default function handler(req: ApiRequest, res: ApiResponse) {
  return handleZones(req, res);
}
