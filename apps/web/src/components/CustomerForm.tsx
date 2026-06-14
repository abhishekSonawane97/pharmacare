'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input, Field, Textarea } from './Input';
import type { Customer, MedicineItem, Medicine } from '@/lib/types';
import { toDateInputValue } from '@/lib/format';

interface CustomerFormProps {
  open: boolean;
  onClose: () => void;
  existing?: Customer | null;
  medicines: Medicine[];
  onSave: (data: {
    name: string;
    phone: string;
    altPhone?: string;
    address?: string;
    notes?: string;
    medicines: MedicineItem[];
    nextDueDate: string;
  }) => Promise<void> | void;
}

export function CustomerForm({ open, onClose, existing, medicines, onSave }: CustomerFormProps) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    altPhone: '',
    address: '',
    notes: '',
    medicines: [] as Array<{ medicineName: string; inCatalog: boolean }>,
    nextDueDate: '',
  });
  const [medSearch, setMedSearch] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setMedSearch('');
    if (existing) {
      setForm({
        name: existing.name,
        phone: existing.phone,
        altPhone: existing.altPhone || '',
        address: existing.address || '',
        notes: existing.notes || '',
        medicines: existing.medicines.map(m => ({
          medicineName: m.medicineName,
          inCatalog: medicines.some(x => x.name.toLowerCase() === m.medicineName.toLowerCase()),
        })),
        nextDueDate: toDateInputValue(existing.nextDueDate),
      });
    } else {
      setForm({ name: '', phone: '', altPhone: '', address: '', notes: '', medicines: [], nextDueDate: '' });
    }
  }, [open, existing, medicines]);

  const trimmed = medSearch.trim();
  const medOptions = useMemo(() => {
    return medicines
      .filter(m => !form.medicines.some(fm => fm.medicineName.toLowerCase() === m.name.toLowerCase()))
      .filter(m => (medSearch ? m.name.toLowerCase().includes(medSearch.toLowerCase()) : true))
      .slice(0, 8);
  }, [medSearch, medicines, form.medicines]);

  const exactInCatalog = useMemo(
    () => medicines.find(m => m.name.toLowerCase() === trimmed.toLowerCase()),
    [trimmed, medicines]
  );
  const alreadyAdded = useMemo(
    () => form.medicines.some(fm => fm.medicineName.toLowerCase() === trimmed.toLowerCase()),
    [trimmed, form.medicines]
  );
  const canAddCustom = trimmed.length >= 2 && !exactInCatalog && !alreadyAdded;

  function addMed(m: Medicine) {
    setForm(f => ({ ...f, medicines: [...f.medicines, { medicineName: m.name, inCatalog: true }] }));
    setMedSearch('');
  }
  function addCustomMed() {
    if (!canAddCustom) return;
    setForm(f => ({ ...f, medicines: [...f.medicines, { medicineName: trimmed, inCatalog: false }] }));
    setMedSearch('');
  }
  function removeMed(i: number) {
    setForm(f => ({ ...f, medicines: f.medicines.filter((_, idx) => idx !== i) }));
  }

  async function submit() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.phone.trim()) e.phone = 'Required';
    if (!form.nextDueDate) e.nextDueDate = 'Required';
    setErrors(e);
    if (Object.keys(e).length) return;

    let iso = '';
    if (form.nextDueDate) {
      const d = new Date(form.nextDueDate);
      if (!isNaN(d.getTime())) iso = d.toISOString();
    }
    setSubmitting(true);
    try {
      await onSave({
        name: form.name.trim(),
        phone: form.phone.trim(),
        altPhone: form.altPhone.trim() || undefined,
        address: form.address.trim() || undefined,
        notes: form.notes.trim() || undefined,
        medicines: form.medicines.map(m => ({ medicineName: m.medicineName })),
        nextDueDate: iso,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Edit customer' : 'Add customer'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>{existing ? 'Save changes' : 'Add customer'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Full name" required error={errors.name}>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} error={errors.name} />
        </Field>
        <Field label="Phone" required error={errors.phone}>
          <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })} placeholder="10 digits" error={errors.phone} />
        </Field>
        <Field label="Alternate phone">
          <Input value={form.altPhone} onChange={e => setForm({ ...form, altPhone: e.target.value.replace(/\D/g, '') })} />
        </Field>
        <Field label="Next due date" required error={errors.nextDueDate}>
          <Input type="date" value={form.nextDueDate} onChange={e => setForm({ ...form, nextDueDate: e.target.value })} />
        </Field>
        <div className="col-span-2">
          <Field label="Address">
            <Textarea rows={2} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          </Field>
        </div>
        <div className="col-span-2">
          <Field
            label="Medicines"
            hint="Type to search your catalog. Anything you add here stays on this customer only — it does not get added to the Medicines section."
          >
            <div className="flex flex-wrap gap-1.5 mb-2 min-h-[26px]">
              {form.medicines.map((m, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 rounded-md px-2 h-[26px] text-[12px] border ${
                    m.inCatalog
                      ? 'bg-[var(--brand-50)] text-[var(--brand-800)] border-[var(--brand-100)]'
                      : 'bg-[color-mix(in_oklab,var(--warning)_10%,transparent)] text-[var(--warning-ink)] border-[color-mix(in_oklab,var(--warning)_25%,transparent)]'
                  }`}
                  title={m.inCatalog ? 'In catalog' : 'Not in your catalog'}
                >
                  {m.medicineName}
                  {!m.inCatalog && <span className="text-[10px] opacity-80">• not in catalog</span>}
                  <button type="button" onClick={() => removeMed(i)} className="hover:text-[var(--danger)]">
                    <X size={12} strokeWidth={1.8} />
                  </button>
                </span>
              ))}
              {form.medicines.length === 0 && (
                <span className="text-[12px] text-[var(--muted)] italic">No medicines added yet</span>
              )}
            </div>
            <div className="relative">
              <Input
                icon={Search}
                placeholder="Search catalog, or type any medicine name…"
                value={medSearch}
                onChange={e => setMedSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && canAddCustom) {
                    e.preventDefault();
                    addCustomMed();
                  }
                }}
              />
              {medSearch && (medOptions.length > 0 || canAddCustom) && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[var(--border)] rounded-md shadow-lg z-10 overflow-hidden max-h-[260px] overflow-y-auto">
                  {medOptions.map(m => (
                    <button
                      key={m._id}
                      type="button"
                      onMouseDown={e => { e.preventDefault(); addMed(m); }}
                      className="w-full text-left px-3 py-2 text-[12.5px] hover:bg-[var(--bg-soft)] flex items-center justify-between"
                    >
                      <span className="text-[var(--ink)]">{m.name}</span>
                      <span className="text-[11.5px] text-[var(--muted)]">{m.content}</span>
                    </button>
                  ))}
                  {canAddCustom && (
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); addCustomMed(); }}
                      className={`w-full text-left px-3 py-2 text-[12.5px] hover:bg-[color-mix(in_oklab,var(--warning)_8%,transparent)] flex items-center justify-between ${
                        medOptions.length > 0 ? 'border-t border-[var(--border)]' : ''
                      }`}
                    >
                      <span className="text-[var(--warning-ink)] font-medium">+ Add &ldquo;{trimmed}&rdquo; to this customer</span>
                      <span className="text-[11px] text-[var(--muted)]">Not in catalog · Enter</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Notes">
            <Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Anything to remember about this customer…" />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
