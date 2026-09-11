import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/httpError';
import { createRecordService, listRecords } from '../services/recordService';

function requireUserId(req: Request): number {
  const id = req.user?.id;
  if (typeof id !== 'number') {
    throw new HttpError(401, 'no autenticado');
  }
  return id;
}

export async function listRecordsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const records = await listRecords(requireUserId(req), req.params.id);
    res.status(200).json(records);
  } catch (err) {
    next(err);
  }
}

export async function createRecordHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const record = await createRecordService(requireUserId(req), req.params.id, req.body);
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
}
