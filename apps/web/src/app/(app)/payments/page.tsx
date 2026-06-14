'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, ArrowDown, ArrowUp, Wallet, Trash2, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { PageHeader, EmptyState } from '@/components/PageHeader';
import { Input } from '@/components/Input';
import { StatCard } from '@/components/StatCard';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Button, IconButton } from '@/components/Button';
import { ConfirmDialog, Modal } from '@/components/Modal';
import { Field, Textarea } from '@/components/Input';
import { fmtINR, fmtDateShort, toDateInputValue } from '@/lib/format';
import type { Payment, Customer } from '@/lib/types';

interface PaymentsResp {
  payments: (Payment & { customerId?: { _id: string; name?: string; phone?: string } | string | null })[];
  total: number;
  summary: { received: number; given: number };
}

export default function PaymentsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [data, setData] = useState<PaymentsResp | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tab, setTab] = useState<'all' | 'received' | 'given'>('all');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Payment | null>(null);

  async function load() {
    try {
      const res = await api<PaymentsResp>('/payments', { query: { type: tab, q, limit: 200 } });
      setData(res);
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Failed to load', tone: 'danger' });
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, q]);

  useEffect(() => {
    api<{ customers: Customer[] }>('/customers', { query: { limit: 200 } }).then(d => setCustomers(d.customers)).catch(() => {});
  }, []);

  async function addPayment(payload: any) {
    try {
      await api('/payments', { method: 'POST', body: payload });
      toast({ message: 'Payment recorded', tone: 'success' });
      setAdding(false);
      await load();
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Save failed', tone: 'danger' });
    }
  }

  async function removePayment(p: Payment) {
    try {
      await api(`/payments/${p._id}`, { method: 'DELETE' });
      toast({ message: 'Record deleted', tone: 'success' });
      await load();
    } catch (err) {
      toast({ message: err instanceof ApiError ? err.message : 'Delete failed', tone: 'danger' });
    }
  }

  const summary = data?.summary ?? { received: 0, given: 0 };
  const payments = data?.payments ?? [];
  const canEdit = user?.role === 'admin';

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Manual ledger of all customer transactions"
        actions={canEdit ? <Button icon={Plus} onClick={() => setAdding(true)}>Record payment</Button> : undefined}
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <StatCard label="Received this month" value={fmtINR(summary.received)} icon={ArrowDown} tone="success" />
        <StatCard label="Given this month" value={fmtINR(summary.given)} icon={ArrowUp} tone="danger" />
        <StatCard label="Net (this month)" value={fmtINR(summary.received - summary.given)} icon={Wallet} />
      </div>

      <div className="bg-white border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="flex flex-col gap-2 px-4 py-3 border-b border-[var(--border)] md:flex-row md:items-center">
          <div className="flex items-center gap-1 bg-[var(--bg-soft)] border border-[var(--border)] p-1 rounded-md self-start">
            {[
              { v: 'all', l: 'All' },
              { v: 'received', l: 'Received' },
              { v: 'given', l: 'Given' },
            ].map(t => (
              <button
                key={t.v}
                onClick={() => setTab(t.v as any)}
                className={`px-3 h-7 rounded text-[12px] font-medium transition-colors ${
                  tab === t.v ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {t.l}
              </button>
            ))}
          </div>
          <div className="flex-1 md:max-w-md">
            <Input icon={Search} placeholder="Search notes, walk-in name…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="md:ml-auto text-[12px] text-[var(--muted)]">{payments.length} records</div>
        </div>

        {payments.length === 0 ? (
          <EmptyState icon={Wallet} title="No payment records" body="Record a payment to start the ledger." />
        ) : (
          <>
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-[13px] min-w-[640px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-[var(--muted)] bg-[var(--bg-soft)]">
                <th className="py-2.5 px-4 font-medium">Date</th>
                <th className="py-2.5 px-4 font-medium">Customer</th>
                <th className="py-2.5 px-4 font-medium">Type</th>
                <th className="py-2.5 px-4 font-medium text-right">Amount</th>
                <th className="py-2.5 px-4 font-medium">Note</th>
                {user?.role === 'admin' && <th className="py-2.5 px-4 w-[60px]"></th>}
              </tr>
            </thead>
            <tbody>
              {payments.map(p => {
                const cust = typeof p.customerId === 'object' && p.customerId !== null ? p.customerId : null;
                const name = cust?.name || p.walkInName || '—';
                const isWalkIn = !cust && !!p.walkInName;
                return (
                  <tr
                    key={p._id}
                    className={`border-t border-[var(--border)] hover:bg-[var(--bg-soft)]/60 group ${cust ? 'cursor-pointer' : ''}`}
                    onClick={() => cust && router.push(`/customers/${(cust as any)._id}`)}
                  >
                    <td className="py-3 px-4 text-[var(--ink-2)] tabular-nums">{fmtDateShort(p.date)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={name} size={28} />
                        <div className="font-medium text-[var(--ink)]">
                          {name}
                          {isWalkIn && <span className="ml-1.5 text-[11px] text-[var(--muted)]">walk-in</span>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge tone={p.type === 'received' ? 'success' : 'danger'} dot>
                        {p.type === 'received' ? 'Received' : 'Given'}
                      </Badge>
                    </td>
                    <td
                      className={`py-3 px-4 text-right tabular-nums font-semibold ${
                        p.type === 'received' ? 'text-[var(--success-ink)]' : 'text-[var(--danger-ink)]'
                      }`}
                    >
                      {p.type === 'received' ? '+' : '−'}{fmtINR(p.amount)}
                    </td>
                    <td className="py-3 px-4 text-[var(--ink-2)] italic max-w-[260px] truncate">
                      {p.notes || <span className="text-[var(--muted)] not-italic">—</span>}
                    </td>
                    {user?.role === 'admin' && (
                      <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                        <div className="opacity-0 group-hover:opacity-100">
                          <IconButton icon={Trash2} tone="danger" onClick={() => setRemoving(p)} />
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          <ul className="md:hidden divide-y divide-[var(--border)]">
            {payments.map(p => {
              const cust = typeof p.customerId === 'object' && p.customerId !== null ? p.customerId : null;
              const name = cust?.name || p.walkInName || '—';
              const isWalkIn = !cust && !!p.walkInName;
              return (
                <li
                  key={p._id}
                  className={`px-4 py-3 ${cust ? 'active:bg-[var(--bg-soft)]/60 cursor-pointer' : ''}`}
                  onClick={() => cust && router.push(`/customers/${(cust as any)._id}`)}
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={name} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-[14px] text-[var(--ink)] truncate">
                            {name}
                            {isWalkIn && <span className="ml-1.5 text-[11px] font-normal text-[var(--muted)]">walk-in</span>}
                          </div>
                          <div className="text-[11.5px] text-[var(--muted)] tabular-nums mt-0.5">{fmtDateShort(p.date)}</div>
                        </div>
                        <div
                          className={`text-[15px] tabular-nums font-semibold whitespace-nowrap ${
                            p.type === 'received' ? 'text-[var(--success-ink)]' : 'text-[var(--danger-ink)]'
                          }`}
                        >
                          {p.type === 'received' ? '+' : '−'}{fmtINR(p.amount)}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <Badge tone={p.type === 'received' ? 'success' : 'danger'} dot>
                          {p.type === 'received' ? 'Received' : 'Given'}
                        </Badge>
                        {user?.role === 'admin' && (
                          <div onClick={e => e.stopPropagation()}>
                            <IconButton icon={Trash2} tone="danger" onClick={() => setRemoving(p)} />
                          </div>
                        )}
                      </div>
                      {p.notes && (
                        <div className="mt-1.5 text-[12px] text-[var(--ink-2)] italic break-words">{p.notes}</div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          </>
        )}
      </div>

      <PaymentFormModal
        open={adding}
        onClose={() => setAdding(false)}
        customers={customers}
        onSave={addPayment}
      />
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && removePayment(removing)}
        title="Delete payment record?"
        message="This will permanently remove the record from the ledger."
        confirmLabel="Delete"
      />
    </div>
  );
}

function PaymentFormModal({
  open,
  onClose,
  customers,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  customers: Customer[];
  onSave: (data: any) => void;
}) {
  const [form, setForm] = useState({
    customerId: '',
    walkIn: false,
    walkInName: '',
    walkInPhone: '',
    type: 'received' as 'received' | 'given',
    amount: '',
    date: '',
    notes: '',
    due: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [custSearch, setCustSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedCustomer = useMemo(() => customers.find(c => c._id === form.customerId) || null, [form.customerId, customers]);

  const matchedCustomers = useMemo(() => {
    const term = custSearch.trim().toLowerCase();
    if (!term) return customers.slice(0, 8);
    return customers.filter(c => {
      return (
        c.name?.toLowerCase().includes(term) ||
        c.phone?.includes(term) ||
        (c as any).altPhone?.includes(term)
      );
    }).slice(0, 8);
  }, [custSearch, customers]);

  useEffect(() => {
    if (open) {
      setForm({
        customerId: '',
        walkIn: false,
        walkInName: '',
        walkInPhone: '',
        type: 'received',
        amount: '',
        date: toDateInputValue(new Date()),
        notes: '',
        due: false,
      });
      setErrors({});
      setCustSearch('');
      setDropdownOpen(false);
    }
  }, [open]);

  function submit() {
    const e: Record<string, string> = {};
    if (!form.walkIn && !form.customerId) e.customerId = 'Required';
    if (form.walkIn && !form.walkInName.trim()) e.walkInName = 'Required';
    if (!form.amount || Number(form.amount) <= 0) e.amount = 'Enter an amount > 0';
    setErrors(e);
    if (Object.keys(e).length) return;

    const dt = new Date(form.date);
    onSave({
      customerId: form.walkIn ? null : form.customerId,
      type: form.type,
      amount: Number(form.amount),
      date: isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString(),
      notes: form.notes || undefined,
      walkIn: form.walkIn,
      walkInName: form.walkIn ? form.walkInName : undefined,
      walkInPhone: form.walkIn ? form.walkInPhone : undefined,
      due: form.walkIn ? form.due : false,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record payment"
      subtitle="Pick a regular customer, or check 'Walk-in' for a one-off transaction."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Save record</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="flex items-center gap-2 text-[12.5px] text-[var(--ink-2)] cursor-pointer">
            <input
              type="checkbox"
              className="accent-[var(--brand-700)]"
              checked={form.walkIn}
              onChange={e => setForm({ ...form, walkIn: e.target.checked, customerId: '' })}
            />
            Walk-in payment (no regular customer record)
          </label>
        </div>

        {form.walkIn ? (
          <>
            <Field label="Person's name" required error={errors.walkInName}>
              <Input value={form.walkInName} onChange={e => setForm({ ...form, walkInName: e.target.value })} />
            </Field>
            <Field label="Phone" hint="Optional">
              <Input value={form.walkInPhone} onChange={e => setForm({ ...form, walkInPhone: e.target.value })} />
            </Field>
          </>
        ) : (
          <div className="col-span-2">
            <Field label="Customer" required error={errors.customerId}>
              {selectedCustomer ? (
                <div className="flex items-center gap-3 h-9 px-3 rounded-md border border-[var(--brand-500)] bg-[color-mix(in_oklab,var(--brand-500)_6%,transparent)]">
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium text-[var(--ink)] truncate">{selectedCustomer.name}</span>
                    <span className="text-[12px] text-[var(--muted)] ml-2">{selectedCustomer.phone}{(selectedCustomer as any).altPhone ? ` · ${(selectedCustomer as any).altPhone}` : ''}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setForm({ ...form, customerId: '' }); setCustSearch(''); setTimeout(() => searchRef.current?.focus(), 50); }}
                    className="text-[var(--muted)] hover:text-[var(--danger)] transition-colors flex-shrink-0"
                  >
                    <X size={14} strokeWidth={2} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    ref={searchRef}
                    type="text"
                    autoComplete="off"
                    placeholder="Search by name, phone or alt phone…"
                    value={custSearch}
                    onChange={e => { setCustSearch(e.target.value); setDropdownOpen(true); }}
                    onFocus={() => setDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                    className={`w-full h-9 pl-8 pr-3 rounded-md border text-[13px] text-[var(--ink)] placeholder:text-[var(--muted)] outline-none transition-colors ${
                      errors.customerId
                        ? 'border-[var(--danger)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--danger)_22%,transparent)]'
                        : 'border-[var(--border)] focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--brand-500)_22%,transparent)]'
                    }`}
                  />
                  <Search size={14} strokeWidth={1.8} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
                  {dropdownOpen && matchedCustomers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[var(--border)] rounded-md shadow-lg z-20 overflow-hidden max-h-[220px] overflow-y-auto">
                      {matchedCustomers.map(c => (
                        <button
                          key={c._id}
                          type="button"
                          onMouseDown={e => { e.preventDefault(); setForm({ ...form, customerId: c._id }); setCustSearch(''); setDropdownOpen(false); }}
                          className="w-full text-left px-3 py-2.5 hover:bg-[var(--bg-soft)] flex items-center justify-between gap-3 border-b border-[var(--border)] last:border-0"
                        >
                          <span className="text-[13px] font-medium text-[var(--ink)] truncate">{c.name}</span>
                          <span className="text-[11.5px] text-[var(--muted)] whitespace-nowrap">
                            {c.phone}{(c as any).altPhone ? ` · ${(c as any).altPhone}` : ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Field>
          </div>
        )}

        <div className="col-span-2">
          <Field label="Type" required>
            <div className="flex gap-2">
              {[
                { v: 'received' as const, l: 'Received', icon: ArrowDown },
                { v: 'given' as const, l: 'Given', icon: ArrowUp },
              ].map(o => {
                const Icon = o.icon;
                const active = form.type === o.v;
                const cls = active
                  ? o.v === 'received'
                    ? 'border-[var(--success)] bg-[color-mix(in_oklab,var(--success)_10%,transparent)] text-[var(--success-ink)]'
                    : 'border-[var(--danger)] bg-[color-mix(in_oklab,var(--danger)_10%,transparent)] text-[var(--danger-ink)]'
                  : 'border-[var(--border)] text-[var(--ink-2)] hover:bg-[var(--bg-soft)]';
                return (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setForm({ ...form, type: o.v })}
                    className={`flex-1 flex items-center justify-center gap-1.5 h-10 rounded-md border text-[13px] transition-colors ${cls}`}
                  >
                    <Icon size={14} strokeWidth={1.8} />
                    {o.l}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>

        <Field label="Amount (₹)" required error={errors.amount}>
          <Input type="number" step="1" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0" />
        </Field>
        <Field label="Date">
          <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
        </Field>

        {form.walkIn && (
          <div className="col-span-2">
            <label className="flex items-center gap-2 text-[12.5px] text-[var(--ink-2)] cursor-pointer">
              <input
                type="checkbox"
                className="accent-[var(--brand-700)]"
                checked={form.due}
                onChange={e => setForm({ ...form, due: e.target.checked })}
              />
              Mark as <b>due / pending</b> (uncheck if already settled in cash)
            </label>
          </div>
        )}

        <div className="col-span-2">
          <Field label="Note" hint="Optional">
            <Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
