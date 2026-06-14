'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Pill, Edit, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { PageHeader, EmptyState } from '@/components/PageHeader';
import { Input, Select, Field } from '@/components/Input';
import { Badge } from '@/components/Badge';
import { Button, IconButton } from '@/components/Button';
import { Modal, ConfirmDialog } from '@/components/Modal';
import type { Medicine } from '@/lib/types';

const TYPE_LABEL: Record<string, string> = {
  tab: 'Tablet/Capsule',
  cap: 'Tablet/Capsule',
  tab_cap: 'Tablet/Capsule',
  syrup: 'Syrup',
  drops: 'Drops',
  cream_lotion: 'Cream/Lotion',
  ayurvedic: 'Ayurvedic',
  dypers: 'dypers',
  other: 'Other',
};

function getBadgeTone(type?: string): 'neutral' | 'brand' | 'success' | 'warning' | 'danger' {
  if (!type) return 'neutral';
  if (type === 'tab' || type === 'cap' || type === 'tab_cap') return 'brand';
  if (type === 'syrup') return 'warning';
  if (type === 'ayurvedic') return 'success';
  return 'neutral';
}

function fmtPrice(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return `₹${value.toLocaleString('en-IN')}`;
}

export default function MedicinesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [removing, setRemoving] = useState<Medicine | null>(null);

  async function load() {
    try {
      const data = await api<{ medicines: Medicine[] }>('/medicines', { query: { q } });
      setMedicines(data.medicines);
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Failed to load', tone: 'danger' });
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return medicines;
    return medicines.filter(m => {
      if (typeFilter === 'tab_cap') {
        return m.type === 'tab' || m.type === 'cap' || m.type === 'tab_cap';
      }
      return m.type === typeFilter;
    });
  }, [medicines, typeFilter]);

  const canEdit = user?.role === 'admin';

  async function save(form: Partial<Medicine>) {
    try {
      if (editing) {
        await api(`/medicines/${editing._id}`, { method: 'PUT', body: form });
        toast({ message: `Updated ${form.name}`, tone: 'success' });
      } else {
        await api('/medicines', { method: 'POST', body: form });
        toast({ message: `Added ${form.name}`, tone: 'success' });
      }
      setAdding(false);
      setEditing(null);
      await load();
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Save failed', tone: 'danger' });
    }
  }

  async function remove(m: Medicine) {
    try {
      await api(`/medicines/${m._id}`, { method: 'DELETE' });
      toast({ message: 'Medicine deleted', tone: 'success' });
      await load();
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Delete failed', tone: 'danger' });
    }
  }

  return (
    <div>
      <PageHeader
        title="Medicines"
        subtitle={`${medicines.length} items in your catalog`}
        actions={canEdit ? <Button icon={Plus} onClick={() => setAdding(true)}>Add medicine</Button> : undefined}
      />

      <div className="bg-white border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="flex flex-col gap-2 px-4 py-3 border-b border-[var(--border)] md:flex-row md:items-center">
          <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="w-full md:w-[170px]">
            <option value="all">All types</option>
            <option value="tab_cap">Tablet/Capsule</option>
            <option value="syrup">Syrup</option>
            <option value="drops">Drops</option>
            <option value="cream_lotion">Cream/Lotion</option>
            <option value="ayurvedic">Ayurvedic</option>
            <option value="dypers">dypers</option>
            <option value="other">Other</option>
          </Select>
          <div className="flex-1 md:max-w-md">
            <Input icon={Search} placeholder="Search by name or content…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="md:ml-auto text-[12px] text-[var(--muted)]">{filtered.length} of {medicines.length}</div>
        </div>

        <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-[13px] min-w-[1020px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-[var(--muted)] bg-[var(--bg-soft)]">
              <th className="py-2.5 px-4 font-medium">Name</th>
              <th className="py-2.5 px-4 font-medium">Content / Generic</th>
              <th className="py-2.5 px-4 font-medium">Location</th>
              <th className="py-2.5 px-4 font-medium">Type</th>
              <th className="py-2.5 px-4 font-medium text-right tabular-nums">Purchase</th>
              <th className="py-2.5 px-4 font-medium text-right tabular-nums">MRP</th>
              <th className="py-2.5 px-4 font-medium text-right tabular-nums">After discount</th>
              <th className="py-2.5 px-4 font-medium">In stock</th>
              <th className="py-2.5 px-4 w-[80px]"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => (
              <tr key={m._id} className="border-t border-[var(--border)] hover:bg-[var(--bg-soft)]/60 group">
                <td className="py-3 px-4 font-medium text-[var(--ink)]">{m.name}</td>
                <td className="py-3 px-4 text-[var(--ink-2)]">
                  {m.content || <span className="text-[var(--muted)] italic">— not set</span>}
                </td>
                <td className="py-3 px-4 text-[var(--ink-2)]">
                  {m.location || <span className="text-[var(--muted)] italic">—</span>}
                </td>
                <td className="py-3 px-4">
                  <Badge tone={getBadgeTone(m.type)}>
                    {(m.type && TYPE_LABEL[m.type]) || '—'}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-right tabular-nums text-[var(--ink-2)]">{fmtPrice(m.purchasePrice)}</td>
                <td className="py-3 px-4 text-right tabular-nums text-[var(--ink-2)]">{fmtPrice(m.mrp)}</td>
                <td className="py-3 px-4 text-right tabular-nums font-medium text-[var(--ink)]">{fmtPrice(m.discountedPrice)}</td>
                <td className="py-3 px-4">
                  <Badge tone={m.inStock ? 'success' : 'danger'} dot>
                    {m.inStock ? 'In stock' : 'Out of stock'}
                  </Badge>
                </td>
                <td className="py-3 px-4">
                  {canEdit && (
                    <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <IconButton icon={Edit} tone="brand" onClick={() => setEditing(m)} />
                      <IconButton icon={Trash2} tone="danger" onClick={() => setRemoving(m)} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <ul className="md:hidden divide-y divide-[var(--border)]">
          {filtered.map(m => (
            <li key={m._id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-[14px] text-[var(--ink)] truncate">{m.name}</div>
                  <div className="mt-0.5 text-[12.5px] text-[var(--ink-2)] break-words">
                    {m.content || <span className="text-[var(--muted)] italic">— content not set</span>}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <IconButton icon={Edit} tone="brand" onClick={() => setEditing(m)} />
                    <IconButton icon={Trash2} tone="danger" onClick={() => setRemoving(m)} />
                  </div>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone={getBadgeTone(m.type)}>
                  {(m.type && TYPE_LABEL[m.type]) || '—'}
                </Badge>
                <Badge tone={m.inStock ? 'success' : 'danger'} dot>
                  {m.inStock ? 'In stock' : 'Out of stock'}
                </Badge>
                {m.location && (
                  <span className="inline-flex items-center h-[22px] px-2 rounded-md bg-[var(--bg-soft)] border border-[var(--border)] text-[11px] text-[var(--ink-2)]">
                    📍 {m.location}
                  </span>
                )}
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2 text-[11.5px]">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">Purchase</div>
                  <div className="tabular-nums text-[var(--ink-2)]">{fmtPrice(m.purchasePrice)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">MRP</div>
                  <div className="tabular-nums text-[var(--ink-2)]">{fmtPrice(m.mrp)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">Discount</div>
                  <div className="tabular-nums font-medium text-[var(--ink)]">{fmtPrice(m.discountedPrice)}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {filtered.length === 0 && <EmptyState icon={Pill} title="No medicines match" body="Try a different search or type filter." />}
      </div>

      <MedicineFormModal open={adding || !!editing} existing={editing} onClose={() => { setAdding(false); setEditing(null); }} onSave={save} />
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove(removing)}
        title={`Delete ${removing?.name}?`}
        message="This medicine will be removed from your catalog. Customer prescriptions referencing it by name keep their text but lose the link."
        confirmLabel="Delete"
      />
    </div>
  );
}

function MedicineFormModal({
  open,
  existing,
  onClose,
  onSave,
}: {
  open: boolean;
  existing: Medicine | null;
  onClose: () => void;
  onSave: (form: Partial<Medicine>) => void;
}) {
  const [form, setForm] = useState<Partial<Medicine>>({
    name: '',
    content: '',
    type: 'tab_cap',
    inStock: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(existing ?? { name: '', content: '', type: 'tab_cap', inStock: true });
  }, [open, existing]);

  function submit() {
    const e: Record<string, string> = {};
    if (!form.name?.trim()) e.name = 'Required';
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave(form);
  }

  function updatePrice(key: 'purchasePrice' | 'mrp' | 'discountedPrice', raw: string) {
    if (raw === '') {
      const { [key]: _omit, ...rest } = form;
      setForm(rest);
      return;
    }
    const n = parseFloat(raw);
    setForm({ ...form, [key]: Number.isFinite(n) && n >= 0 ? n : undefined });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Edit medicine' : 'Add medicine'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>{existing ? 'Save changes' : 'Add medicine'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Brand name" required error={errors.name} hint="e.g. Paracetamol 500mg">
            <Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} error={errors.name} />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Content / Generic" hint="Active ingredient(s)">
            <Input value={form.content || ''} onChange={e => setForm({ ...form, content: e.target.value })} />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Location" hint="Where it's stored — e.g. Rack A-3, Refrigerator, Front counter">
            <Input value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })} />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Type" required>
            <Select
              className="w-full"
              value={form.type === 'tab' || form.type === 'cap' ? 'tab_cap' : (form.type || 'tab_cap')}
              onChange={e => setForm({ ...form, type: e.target.value as any })}
            >
              <option value="tab_cap">Tablet/Capsule</option>
              <option value="syrup">Syrup</option>
              <option value="drops">Drops</option>
              <option value="cream_lotion">Cream/Lotion</option>
              <option value="ayurvedic">Ayurvedic</option>
              <option value="dypers">dypers</option>
              <option value="other">Other</option>
            </Select>
          </Field>
        </div>
        <div className="col-span-2 grid grid-cols-3 gap-3">
          <Field label="Purchase price (₹)" hint="Wholesale cost">
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.purchasePrice ?? ''}
              onChange={e => updatePrice('purchasePrice', e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Selling price / MRP (₹)" hint="Printed price">
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.mrp ?? ''}
              onChange={e => updatePrice('mrp', e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="After discount (₹)" hint="Actual charged price">
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.discountedPrice ?? ''}
              onChange={e => updatePrice('discountedPrice', e.target.value)}
              placeholder="0"
            />
          </Field>
        </div>
        <div className="col-span-2">
          <label className="flex items-center gap-2 text-[12.5px] text-[var(--ink-2)] cursor-pointer">
            <input
              type="checkbox"
              className="accent-[var(--brand-700)]"
              checked={!!form.inStock}
              onChange={e => setForm({ ...form, inStock: e.target.checked })}
            />
            In stock
          </label>
        </div>
      </div>
    </Modal>
  );
}
