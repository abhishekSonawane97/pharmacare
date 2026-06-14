import { Router } from 'express';
import { z } from 'zod';
import { modelsFor } from '../db/models';
import { ah } from '../utils/asyncHandler';
import { notFound, validationError } from '../utils/errors';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { normalizePhone } from '../utils/phone';

const router = Router();
router.use(requireAuth);

const medicineItemSchema = z.object({
  medicineName: z.string().min(1),
  dosage: z.string().optional(),
});

const customerCreateSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  altPhone: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  medicines: z.array(medicineItemSchema).default([]),
  nextDueDate: z.string().min(1),
});

const dueDateSchema = z.object({ nextDueDate: z.string().min(1) });

router.get(
  '/',
  ah(async (req, res) => {
    const { Customer } = modelsFor(req);
    const q = (req.query.q as string | undefined)?.trim() || '';
    const filter = (req.query.filter as string | undefined) || 'all';
    const sort = (req.query.sort as string | undefined) || 'due_date';
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt((req.query.limit as string) || '50', 10)));

    const conditions: any = { isActive: true };
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      conditions.$or = [{ name: re }, { phone: re }, { altPhone: re }];
    }

    const now = new Date();
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    if (filter === 'overdue') {
      conditions.nextDueDate = { $lt: startOfToday };
    } else if (filter === 'due_this_week') {
      const endOfWeek = new Date(startOfToday); endOfWeek.setDate(endOfWeek.getDate() + 7);
      conditions.nextDueDate = { $gte: startOfToday, $lte: endOfWeek };
    }

    const sortObj: any = sort === 'name' ? { name: 1 } : { nextDueDate: 1 };
    const total = await Customer.countDocuments(conditions);
    const customers = await Customer.find(conditions)
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({ data: { customers, total, page, limit } });
  })
);

router.get(
  '/:id',
  ah(async (req, res) => {
    const { Customer, Payment } = modelsFor(req);
    const customer = await Customer.findById(req.params.id);
    if (!customer || !customer.isActive) throw notFound('Customer not found');
    const recentPayments = await Payment.find({ customerId: customer._id })
      .sort({ date: -1 })
      .limit(10)
      .lean();
    res.json({ data: { customer, recentPayments } });
  })
);

router.post(
  '/',
  ah(async (req, res) => {
    const { Customer, ActivityLog } = modelsFor(req);
    const body = customerCreateSchema.parse(req.body);
    const due = new Date(body.nextDueDate);
    if (Number.isNaN(due.getTime())) throw validationError('Invalid nextDueDate');

    const customer = await Customer.create({
      name: body.name.trim(),
      phone: normalizePhone(body.phone),
      altPhone: body.altPhone ? normalizePhone(body.altPhone) : undefined,
      address: body.address || undefined,
      notes: body.notes || undefined,
      medicines: body.medicines,
      nextDueDate: due,
      createdBy: req.user!._id,
    });

    await ActivityLog.create({
      actorId: req.user!._id,
      actorName: req.user!.name,
      action: 'customer.create',
      targetType: 'customer',
      targetId: customer._id,
      targetName: customer.name,
    });

    res.status(201).json({ data: { customer } });
  })
);

router.put(
  '/:id',
  requireAdmin,
  ah(async (req, res) => {
    const { Customer, ActivityLog } = modelsFor(req);
    const body = customerCreateSchema.parse(req.body);
    const customer = await Customer.findById(req.params.id);
    if (!customer || !customer.isActive) throw notFound('Customer not found');

    const newDue = new Date(body.nextDueDate);
    if (Number.isNaN(newDue.getTime())) throw validationError('Invalid nextDueDate');
    const dueChanged = newDue.getTime() !== new Date(customer.nextDueDate).getTime();

    const changedFields: string[] = [];
    if (customer.name !== body.name.trim()) changedFields.push('name');
    if (customer.phone !== normalizePhone(body.phone)) changedFields.push('phone');
    if ((customer.altPhone || '') !== (body.altPhone ? normalizePhone(body.altPhone) : '')) changedFields.push('altPhone');
    if ((customer.address || '') !== (body.address || '')) changedFields.push('address');
    if ((customer.notes || '') !== (body.notes || '')) changedFields.push('notes');
    if (JSON.stringify(customer.medicines.map(m => m.medicineName)) !== JSON.stringify(body.medicines.map(m => m.medicineName))) changedFields.push('medicines');
    if (dueChanged) changedFields.push('nextDueDate');

    customer.name = body.name.trim();
    customer.phone = normalizePhone(body.phone);
    customer.altPhone = body.altPhone ? normalizePhone(body.altPhone) : undefined;
    customer.address = body.address || undefined;
    customer.notes = body.notes || undefined;
    customer.medicines = body.medicines as any;
    customer.nextDueDate = newDue;

    if (dueChanged) {
      customer.autoReminderSentForCycle = false;
      customer.autoReminderSentAt = null;
      customer.reminderIgnored = false;
    }

    await customer.save();

    await ActivityLog.create({
      actorId: req.user!._id,
      actorName: req.user!.name,
      action: 'customer.update',
      targetType: 'customer',
      targetId: customer._id,
      targetName: customer.name,
      metadata: { changedFields },
    });

    res.json({ data: { customer } });
  })
);

router.patch(
  '/:id/due-date',
  requireAdmin,
  ah(async (req, res) => {
    const { Customer, ActivityLog } = modelsFor(req);
    const { nextDueDate } = dueDateSchema.parse(req.body);
    const customer = await Customer.findById(req.params.id);
    if (!customer || !customer.isActive) throw notFound('Customer not found');
    const due = new Date(nextDueDate);
    if (Number.isNaN(due.getTime())) throw validationError('Invalid nextDueDate');
    customer.nextDueDate = due;
    customer.autoReminderSentForCycle = false;
    customer.autoReminderSentAt = null;
    customer.reminderIgnored = false;
    await customer.save();
    await ActivityLog.create({
      actorId: req.user!._id,
      actorName: req.user!.name,
      action: 'customer.due_date_update',
      targetType: 'customer',
      targetId: customer._id,
      targetName: customer.name,
      metadata: { nextDueDate: due.toISOString() },
    });
    res.json({ data: { customer } });
  })
);

router.delete(
  '/:id',
  requireAdmin,
  ah(async (req, res) => {
    const { Customer, ActivityLog } = modelsFor(req);
    const customer = await Customer.findById(req.params.id);
    if (!customer) throw notFound('Customer not found');
    customer.isActive = false;
    await customer.save();
    await ActivityLog.create({
      actorId: req.user!._id,
      actorName: req.user!.name,
      action: 'customer.delete',
      targetType: 'customer',
      targetId: customer._id,
      targetName: customer.name,
    });
    res.json({ data: { customer } });
  })
);

router.post(
  '/:id/ignore',
  requireAdmin,
  ah(async (req, res) => {
    const { Customer, ActivityLog } = modelsFor(req);
    const customer = await Customer.findById(req.params.id);
    if (!customer || !customer.isActive) throw notFound('Customer not found');
    customer.reminderIgnored = true;
    await customer.save();
    await ActivityLog.create({
      actorId: req.user!._id,
      actorName: req.user!.name,
      action: 'customer.ignore',
      targetType: 'customer',
      targetId: customer._id,
      targetName: customer.name,
    });
    res.json({ data: { customer } });
  })
);

router.post(
  '/:id/unignore',
  requireAdmin,
  ah(async (req, res) => {
    const { Customer, ActivityLog } = modelsFor(req);
    const customer = await Customer.findById(req.params.id);
    if (!customer || !customer.isActive) throw notFound('Customer not found');
    customer.reminderIgnored = false;
    await customer.save();
    await ActivityLog.create({
      actorId: req.user!._id,
      actorName: req.user!.name,
      action: 'customer.unignore',
      targetType: 'customer',
      targetId: customer._id,
      targetName: customer.name,
    });
    res.json({ data: { customer } });
  })
);

export default router;
