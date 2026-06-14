import { Router } from 'express';
import { z } from 'zod';
import { modelsFor } from '../db/models';
import { ah } from '../utils/asyncHandler';
import { conflict, notFound } from '../utils/errors';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const medicineSchema = z.object({
  name: z.string().min(1),
  content: z.string().optional().or(z.literal('')),
  category: z.string().optional().or(z.literal('')),
  location: z.string().optional().or(z.literal('')),
  type: z.enum(['tab', 'cap', 'tab_cap', 'syrup', 'drops', 'cream_lotion', 'ayurvedic', 'dypers', 'other']).optional(),
  inStock: z.boolean().optional(),
  purchasePrice: z.number().nonnegative().optional(),
  mrp: z.number().nonnegative().optional(),
  discountedPrice: z.number().nonnegative().optional(),
  addedFrom: z.enum(['manual', 'bill']).optional(),
});

router.get(
  '/',
  ah(async (req, res) => {
    const { Medicine } = modelsFor(req);
    const q = (req.query.q as string | undefined)?.trim();
    const inStock = req.query.inStock as string | undefined;
    const conditions: any = {};
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      conditions.$or = [{ name: re }, { content: re }];
    }
    if (inStock === 'true') conditions.inStock = true;
    if (inStock === 'false') conditions.inStock = false;
    const medicines = await Medicine.find(conditions).sort({ name: 1 }).lean();
    res.json({ data: { medicines } });
  })
);

router.post(
  '/',
  requireAdmin,
  ah(async (req, res) => {
    const { Medicine, ActivityLog } = modelsFor(req);
    const body = medicineSchema.parse(req.body);
    const dupe = await Medicine.findOne({ name: new RegExp(`^${body.name.trim()}$`, 'i') });
    if (dupe) throw conflict('A medicine with that name already exists');
    const medicine = await Medicine.create({
      ...body,
      name: body.name.trim(),
      content: body.content || undefined,
      category: body.category || undefined,
      location: body.location || undefined,
    });
    await ActivityLog.create({
      actorId: req.user!._id,
      actorName: req.user!.name,
      action: 'medicine.create',
      targetType: 'medicine',
      targetId: medicine._id,
      targetName: medicine.name,
    });
    res.status(201).json({ data: { medicine } });
  })
);

router.put(
  '/:id',
  requireAdmin,
  ah(async (req, res) => {
    const { Medicine, ActivityLog } = modelsFor(req);
    const body = medicineSchema.partial().parse(req.body);
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) throw notFound('Medicine not found');
    Object.assign(medicine, body);
    if (body.name) medicine.name = body.name.trim();
    await medicine.save();
    await ActivityLog.create({
      actorId: req.user!._id,
      actorName: req.user!.name,
      action: 'medicine.update',
      targetType: 'medicine',
      targetId: medicine._id,
      targetName: medicine.name,
    });
    res.json({ data: { medicine } });
  })
);

router.delete(
  '/:id',
  requireAdmin,
  ah(async (req, res) => {
    const { Medicine, ActivityLog } = modelsFor(req);
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) throw notFound('Medicine not found');
    await medicine.deleteOne();
    await ActivityLog.create({
      actorId: req.user!._id,
      actorName: req.user!.name,
      action: 'medicine.delete',
      targetType: 'medicine',
      targetId: medicine._id,
      targetName: medicine.name,
    });
    res.status(204).send();
  })
);

export default router;
