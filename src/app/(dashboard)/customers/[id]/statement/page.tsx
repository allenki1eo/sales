"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface StatementLine {
  date: string;
  type: "invoice" | "credit_note" | "payment";
  ref: string;
  description: string;
  debit: number;
  credit: number;
  link?: string;
}

interface Statement {
  customer: { id: number; name: string; location: string; phone: string };
  from: string | null;
  to: string | null;
  opening_balance: number;
  lines: StatementLine[];
  total_debits: number;
  total_credits: number;
  closing_balance: number;
}

const TYPE_STYLES: Record<string, string> = {
  invoice:     "bg-indigo-100 text-indigo-700",
  credit_note: "bg-rose-100 text-rose-700",
  payment:     "bg-emerald-100 text-emerald-700",
};

const TYPE_LABELS: Record<string, string> = {
  invoice:     "Invoice",
  credit_note: "Credit Note",
  payment:     "Payment",
};

function defaultFrom() {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toISOString().slice(0, 10);
}

export default function CustomerStatementPage() {
  const params = useParams();
  const [statement, setStatement] = useState<Statement | null>(null);
  const [loading, setLoading]     = useState(true);
  const [from, setFrom]           = useState(defaultFrom());
  const [to, setTo]               = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const res = await fetch(`/api/customers/${params.id}/statement?${qs}`);
    const d = await res.json();
    if (!res.ok) {
      toast.error(d.error || "Failed to load statement");
      setStatement(null);
    } else {
      setStatement(d);
    }
    setLoading(false);
  }, [params.id, from, to]);

  useEffect(() => { load(); }, [load]);

  // Running balance per visible line
  const withBalance = statement
    ? statement.lines.reduce<Array<StatementLine & { balance: number }>>((acc, l) => {
        const prev = acc.length ? acc[acc.length - 1].balance : statement.opening_balance;
        acc.push({ ...l, balance: prev + l.debit - l.credit });
        return acc;
      }, [])
    : [];

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-6 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/customers/${params.id}`}><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <FileText className="h-6 w-6 text-indigo-500" />
                Statement of Account
              </h1>
              {statement && (
                <p className="text-sm text-muted-foreground">
                  {statement.customer.name}
                  {statement.customer.location ? ` — ${statement.customer.location}` : ""}
                </p>
              )}
            </div>
          </div>
          <Button variant="outline" onClick={() => window.print()} disabled={!statement}>
            <Printer className="h-4 w-4" /> Print / PDF
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6 flex flex-col sm:flex-row gap-4 sm:items-end">
            <div className="space-y-2">
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
            </div>
            <p className="text-xs text-muted-foreground sm:ml-auto sm:pb-2">
              Invoices are approved/dispatched orders. Credit notes count once approved.
            </p>
          </CardContent>
        </Card>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-20 rounded-xl bg-muted" />
            <div className="h-64 rounded-xl bg-muted" />
          </div>
        ) : !statement ? null : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Opening Balance</p>
                <p className="text-lg font-bold">{formatCurrency(statement.opening_balance)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Invoiced (Debits)</p>
                <p className="text-lg font-bold text-indigo-600">{formatCurrency(statement.total_debits)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Paid &amp; Credited</p>
                <p className="text-lg font-bold text-emerald-600">{formatCurrency(statement.total_credits)}</p>
              </CardContent></Card>
              <Card className="border-l-4 border-l-indigo-500"><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Closing Balance {statement.closing_balance > 0 ? "(Owed)" : ""}</p>
                <p className={`text-lg font-bold ${statement.closing_balance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {formatCurrency(statement.closing_balance)}
                </p>
              </CardContent></Card>
            </div>

            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left">
                      <th className="p-3 font-medium">Date</th>
                      <th className="p-3 font-medium">Ref</th>
                      <th className="p-3 font-medium">Description</th>
                      <th className="p-3 font-medium text-right">Debit</th>
                      <th className="p-3 font-medium text-right">Credit</th>
                      <th className="p-3 font-medium text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b bg-muted/20">
                      <td className="p-3" colSpan={5}>
                        <span className="font-medium">Opening balance</span>
                        {statement.from && <span className="text-muted-foreground"> as at {formatDate(statement.from)}</span>}
                      </td>
                      <td className="p-3 text-right font-medium">{formatCurrency(statement.opening_balance)}</td>
                    </tr>
                    {withBalance.map((l, i) => (
                      <tr key={i} className="border-b hover:bg-muted/30">
                        <td className="p-3 whitespace-nowrap">{formatDate(l.date)}</td>
                        <td className="p-3 whitespace-nowrap">
                          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium mr-2 ${TYPE_STYLES[l.type]}`}>
                            {TYPE_LABELS[l.type]}
                          </span>
                          {l.link ? (
                            <Link href={l.link} className="text-indigo-600 hover:underline">{l.ref}</Link>
                          ) : l.ref}
                        </td>
                        <td className="p-3">{l.description}</td>
                        <td className="p-3 text-right">{l.debit ? formatCurrency(l.debit) : "—"}</td>
                        <td className="p-3 text-right">{l.credit ? formatCurrency(l.credit) : "—"}</td>
                        <td className="p-3 text-right font-medium">{formatCurrency(l.balance)}</td>
                      </tr>
                    ))}
                    {!withBalance.length && (
                      <tr>
                        <td className="p-8 text-center text-muted-foreground" colSpan={6}>
                          No transactions in this period
                        </td>
                      </tr>
                    )}
                    <tr className="border-t-2 font-semibold bg-muted/20">
                      <td className="p-3" colSpan={3}>Totals / Closing balance</td>
                      <td className="p-3 text-right">{formatCurrency(statement.total_debits)}</td>
                      <td className="p-3 text-right">{formatCurrency(statement.total_credits)}</td>
                      <td className="p-3 text-right">{formatCurrency(statement.closing_balance)}</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ── PRINT DOCUMENT ── */}
      {statement && (
        <div className="hidden print-only">
          <div className="p-8 text-black">
            <div className="text-center border-b-2 border-black pb-4 mb-6">
              <h1 className="text-xl font-bold uppercase">East African Spirit (T) Ltd</h1>
              <p className="text-sm mt-1 font-semibold uppercase tracking-wider">Statement of Account</p>
            </div>

            <div className="flex justify-between text-sm mb-6">
              <div>
                <p className="font-semibold">{statement.customer.name}</p>
                {statement.customer.location && <p>{statement.customer.location}</p>}
                {statement.customer.phone && <p>{statement.customer.phone}</p>}
              </div>
              <div className="text-right">
                <p><span className="font-semibold">Period:</span> {statement.from ? formatDate(statement.from) : "Start"} — {statement.to ? formatDate(statement.to) : "Today"}</p>
                <p><span className="font-semibold">Printed:</span> {formatDate(new Date())}</p>
              </div>
            </div>

            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-black text-left">
                  <th className="py-2">Date</th>
                  <th className="py-2">Ref</th>
                  <th className="py-2">Description</th>
                  <th className="py-2 text-right">Debit</th>
                  <th className="py-2 text-right">Credit</th>
                  <th className="py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-300">
                  <td className="py-1.5" colSpan={5}>Opening balance{statement.from ? ` as at ${formatDate(statement.from)}` : ""}</td>
                  <td className="py-1.5 text-right">{Math.round(statement.opening_balance).toLocaleString()}</td>
                </tr>
                {withBalance.map((l, i) => (
                  <tr key={i} className="border-b border-gray-300 print-no-break">
                    <td className="py-1.5 whitespace-nowrap">{formatDate(l.date)}</td>
                    <td className="py-1.5 whitespace-nowrap">{l.ref}</td>
                    <td className="py-1.5">{l.description}</td>
                    <td className="py-1.5 text-right">{l.debit ? Math.round(l.debit).toLocaleString() : "—"}</td>
                    <td className="py-1.5 text-right">{l.credit ? Math.round(l.credit).toLocaleString() : "—"}</td>
                    <td className="py-1.5 text-right">{Math.round(l.balance).toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-black font-bold">
                  <td className="py-2" colSpan={3}>CLOSING BALANCE (TZS)</td>
                  <td className="py-2 text-right">{Math.round(statement.total_debits).toLocaleString()}</td>
                  <td className="py-2 text-right">{Math.round(statement.total_credits).toLocaleString()}</td>
                  <td className="py-2 text-right">{Math.round(statement.closing_balance).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <p className="text-xs mt-6 text-gray-600">
              All amounts in Tanzanian Shillings. Invoices reflect approved and dispatched orders;
              credit notes are included once approved.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
