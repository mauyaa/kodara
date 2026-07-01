"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Check,
  FileText,
  Home,
  MessageSquare,
  Phone,
  Plus,
  Send,
  Settings,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useKodara } from "@/lib/KodaraContext";
import { formatDate, formatKES } from "@/lib/utils";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card, CardContent } from "./ui/Card";

type Tab = "home" | "repairs" | "messages" | "documents";

export function TenantPortal({ onSwitchRole }: { onSwitchRole: () => void }) {
  const data = useKodara();
  const [tab, setTab] = useState<Tab>("home");
  const [payOpen, setPayOpen] = useState(false);
  const [repairOpen, setRepairOpen] = useState(false);
  const [success, setSuccess] = useState<{
    amount: number;
    reference: string;
    confirmed: boolean;
  } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [sendingCheckIn, setSendingCheckIn] = useState(false);

  useEffect(() => {
    if (!payOpen && !repairOpen && !success) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPayOpen(false);
      setRepairOpen(false);
      setSuccess(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [payOpen, repairOpen, success]);

  const tenant = data.currentTenant ?? data.tenants[0];
  const tenantMaintenance = data.maintenance.filter(
    (item) => !tenant || item.tenant_id === tenant.id,
  );
  const tenantDocuments = data.documents.filter(
    (item) =>
      !tenant ||
      item.tenant_id === tenant.id ||
      item.property_id ===
        data.units.find((unit) => unit.id === tenant.unit_id)?.property_id,
  );

  if (data.isLoading && !tenant)
    return (
      <div className="grid min-h-screen place-items-center">
        Loading tenant home…
      </div>
    );

  if (!tenant)
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div className="max-w-xs">
          <div className="font-semibold">No tenant record found</div>
          <p className="mt-2 text-sm text-muted">
            Your account isn&apos;t linked to a unit yet. Contact your
            property manager to get set up.
          </p>
          <Button className="mt-5" variant="secondary" onClick={onSwitchRole}>
            Switch role
          </Button>
        </div>
      </div>
    );

  const pay = async () => {
    setProcessing(true);
    try {
      const payment = await data.payRent();
      if (!payment) {
        toast.info("There is no outstanding balance");
        return;
      }
      setPayOpen(false);
      setSuccess({
        amount: payment.amount,
        reference: payment.mpesa_receipt ?? payment.reference ?? "Confirmed",
        confirmed: payment.status === "completed",
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not start the M-Pesa payment. Please try again.",
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="tenant-shell">
      <header className="tenant-header">
        <div className="flex items-center gap-3">
          <div className="brand-mark">
            <Home size={17} />
          </div>
          <div>
            <div className="brand-word">
              kodara<span>.</span>
            </div>
            <div className="text-[10px] uppercase tracking-[.18em] text-muted">
              My home
            </div>
          </div>
        </div>
        <button className="avatar-button" onClick={onSwitchRole}>
          {tenant.full_name
            .split(" ")
            .map((name) => name[0])
            .join("")
            .slice(0, 2)}
        </button>
      </header>

      <main className="tenant-content">
        {data.loadError && !data.isLoading && (
          <div
            role="alert"
            className="mb-4 flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--error-border)] bg-[var(--error-tint)] p-4 text-sm text-[var(--error)] sm:flex-row sm:items-center sm:justify-between"
          >
            <span>{data.loadError}</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void data.refreshData()}
            >
              Retry
            </Button>
          </div>
        )}
        {tab === "home" && (
          <>
            <div className="mb-6">
              <div className="workspace-eyebrow">Your home</div>
              <h1 className="mt-1">{tenant.property_name}</h1>
              <p className="text-sm text-[var(--accent-dark)]">
                Unit {tenant.unit_name} · Nairobi
              </p>
            </div>
            <div className="balance-card">
              <div className="text-xs uppercase tracking-[.15em] text-white/60">
                Current balance
              </div>
              <div className="my-3 text-hero text-white">
                {formatKES(tenant.outstanding_balance)}
              </div>
              <div className="text-sm text-white/70">Due 5 July 2026</div>
              <Button
                className="mt-6 w-full bg-white !text-[var(--ink)] hover:bg-[var(--accent-tint)]"
                size="lg"
                disabled={!tenant.outstanding_balance}
                onClick={() => setPayOpen(true)}
              >
                <Phone size={16} />
                {tenant.outstanding_balance
                  ? "Pay with M-Pesa"
                  : "Rent paid in full"}
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Card>
                <CardContent>
                  <div className="metric-label">Next rent</div>
                  <div className="mt-2 text-xl font-semibold">
                    {formatKES(
                      data.units.find((unit) => unit.id === tenant.unit_id)
                        ?.monthly_rent ?? 0,
                    )}
                  </div>
                  <div className="text-xs text-[var(--accent-dark)]">5 August</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <div className="metric-label">Open repairs</div>
                  <div className="mt-2 text-xl font-semibold">
                    {
                      tenantMaintenance.filter(
                        (item) => item.status !== "completed",
                      ).length
                    }
                  </div>
                  <div className="text-xs text-[var(--accent-dark)]">Live updates</div>
                </CardContent>
              </Card>
            </div>
            <div className="mt-7 flex items-center justify-between">
              <h2 className="text-lg">Recent activity</h2>
              <button className="text-link" onClick={() => setTab("repairs")}>
                See repairs
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {tenantMaintenance.slice(0, 2).map((item) => (
                <Card key={item.id}>
                  <CardContent className="flex gap-3">
                    <span className="activity-icon">
                      <Wrench size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        <strong className="truncate text-sm">
                          {item.title}
                        </strong>
                        <Badge
                          variant={
                            item.status === "completed" ? "success" : "teal"
                          }
                        >
                          {item.status.replaceAll("_", " ")}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted">
                        {item.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {tab === "repairs" && (
          <>
            <div className="workspace-heading">
              <div>
                <div className="workspace-eyebrow">Maintenance</div>
                <h1>Repairs</h1>
                <p>Report an issue and follow every update.</p>
              </div>
              <Button onClick={() => setRepairOpen(true)}>
                <Plus size={15} />
                New request
              </Button>
            </div>
            {tenantMaintenance.length === 0 ? (
              <EmptyState
                icon={Wrench}
                title="No repair requests yet"
                description="Report an issue and your property manager will be notified right away."
                action={
                  <Button onClick={() => setRepairOpen(true)}>
                    <Plus size={15} />
                    New request
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                {tenantMaintenance.map((item) => (
                  <Card key={item.id}>
                    <CardContent>
                      <div className="flex justify-between gap-3">
                        <div>
                          <div className="font-semibold">{item.title}</div>
                          <div className="mt-1 text-sm text-muted">
                            {item.description}
                          </div>
                        </div>
                        <Badge
                          variant={
                            item.status === "completed" ? "success" : "teal"
                          }
                        >
                          {item.status.replaceAll("_", " ")}
                        </Badge>
                      </div>
                      <div className="mt-4 flex items-center gap-2 border-t pt-3 text-xs text-muted">
                        <Check size={14} className="text-[var(--accent-dark)]" />
                        Updated {formatDate(item.updated_at)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "messages" && (
          <>
            <div className="workspace-heading">
              <div>
                <div className="workspace-eyebrow">Inbox</div>
                <h1>Messages</h1>
                <p>Talk securely with your property team.</p>
              </div>
            </div>
            {(() => {
              const tenantMessages = data.messages.filter(
                (message) =>
                  message.sender_id === tenant.user_id ||
                  message.receiver_id === tenant.user_id,
              );
              return tenantMessages.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="No messages yet"
                  description="Conversations with your property manager will show up here."
                />
              ) : (
                <div className="space-y-3">
                  {tenantMessages.map((message) => (
                    <Card key={message.id}>
                      <CardContent>
                        <div className="flex gap-3">
                          <div className="avatar-small dark">
                            {message.sender_name[0]}
                          </div>
                          <div>
                            <div className="font-semibold">
                              {message.sender_name}
                            </div>
                            <div className="text-xs text-muted">
                              {message.subject}
                            </div>
                            <p className="mt-2 text-sm">{message.content}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              );
            })()}
            <Button
              className="mt-4 w-full"
              variant="secondary"
              loading={sendingCheckIn}
              onClick={async () => {
                setSendingCheckIn(true);
                try {
                  await data.sendMessage({
                    receiverId: "user-landlord",
                    receiverName: "Peter Kamau",
                    subject: "Tenant check-in",
                    content:
                      "Hello, I would like to speak with the property manager.",
                  });
                  toast.success("Message sent");
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Could not send your message. Please try again.",
                  );
                } finally {
                  setSendingCheckIn(false);
                }
              }}
            >
              <Send size={15} />
              Message property manager
            </Button>
          </>
        )}

        {tab === "documents" && (
          <>
            <div className="workspace-heading">
              <div>
                <div className="workspace-eyebrow">Records</div>
                <h1>Documents</h1>
                <p>Your leases and payment records.</p>
              </div>
            </div>
            {tenantDocuments.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No documents yet"
                description="Your lease, receipts, and inspection reports will appear here."
              />
            ) : (
              <div className="space-y-3">
                {tenantDocuments.map((document) => (
                  <Card key={document.id}>
                    <CardContent className="flex items-center gap-3">
                      <div className="document-icon">
                        <FileText size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">
                          {document.name}
                        </div>
                        <div className="text-xs text-muted">
                          {document.type} · {formatDate(document.created_at)}
                        </div>
                      </div>
                      <Badge variant="teal">{document.type}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <nav className="tenant-nav">
        {(
          [
            { id: "home", label: "Home", icon: Home },
            { id: "repairs", label: "Repairs", icon: Wrench },
            { id: "messages", label: "Messages", icon: MessageSquare },
            { id: "documents", label: "Documents", icon: FileText },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setTab(id)}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
        <button onClick={onSwitchRole} aria-label="Switch role">
          <Settings size={18} />
          <span>Switch</span>
        </button>
      </nav>

      {payOpen && (
        <div className="modal-overlay" onClick={() => setPayOpen(false)}>
          <div
            className="modal p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-between">
              <div>
                <div className="workspace-eyebrow">M-Pesa STK push</div>
                <h2 id="payment-dialog-title" className="mt-1">
                  Confirm payment
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close payment dialog"
                onClick={() => setPayOpen(false)}
              >
                <X />
              </button>
            </div>
            <div className="my-7 rounded-[var(--radius-lg)] bg-[var(--accent-tint)] p-5 text-center">
              <div className="text-xs text-muted">Amount</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">
                {formatKES(tenant.outstanding_balance)}
              </div>
              <div className="mt-2 text-xs text-muted">
                to {tenant.property_name}
              </div>
            </div>
            <Button
              className="w-full"
              size="lg"
              loading={processing}
              onClick={pay}
            >
              Send prompt to {tenant.phone}
            </Button>
            <p className="mt-3 text-center text-xs text-muted">
              You will confirm securely with your M-Pesa PIN.
            </p>
          </div>
        </div>
      )}
      {repairOpen && (
        <RepairModal
          close={() => setRepairOpen(false)}
          submit={async (category, description) => {
            setProcessing(true);
            try {
              await data.submitMaintenance({
                category,
                description,
                tenantId: tenant.id,
                unitId: tenant.unit_id,
              });
              setRepairOpen(false);
              toast.success("Request sent to your property manager");
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not submit your request. Please try again.",
              );
            } finally {
              setProcessing(false);
            }
          }}
          processing={processing}
        />
      )}
      {success && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/75 p-4">
          <div
            className="w-full max-w-sm rounded-[var(--radius-xl)] bg-white p-8 text-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-success-title"
          >
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--accent-tint)] text-[var(--accent-dark)]">
              <Check size={30} />
            </div>
            <h2 id="payment-success-title" className="mt-5">
              {success.confirmed ? "Payment confirmed" : "Payment prompt sent"}
            </h2>
            <div className="my-3 text-2xl font-semibold text-[var(--accent-dark)]">
              {formatKES(success.amount)}
            </div>
            <div className="text-sm text-muted">
              M-Pesa · {success.reference}
            </div>
            {!success.confirmed && (
              <p className="mt-3 text-sm text-muted">
                Complete the prompt on your phone. Kodara will update your
                balance when Safaricom confirms the payment.
              </p>
            )}
            <Button className="mt-7 w-full" onClick={() => setSuccess(null)}>
              Back home
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function RepairModal({
  close,
  submit,
  processing,
}: {
  close: () => void;
  submit: (category: string, description: string) => Promise<void>;
  processing: boolean;
}) {
  const [category, setCategory] = useState("Plumbing");
  const [description, setDescription] = useState("");
  return (
    <div className="modal-overlay" onClick={close}>
      <div
        className="modal p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="repair-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex justify-between">
          <div>
            <div className="workspace-eyebrow">Maintenance</div>
            <h2 id="repair-dialog-title">Report a problem</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close repair dialog"
            onClick={close}
          >
            <X />
          </button>
        </div>
        <label className="label" htmlFor="repair-category">
          Category
        </label>
        <select
          id="repair-category"
          className="input mb-4"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option>Plumbing</option>
          <option>Electrical</option>
          <option>Security</option>
          <option>Appliance</option>
          <option>General</option>
        </select>
        <label className="label" htmlFor="repair-description">
          What happened?
        </label>
        <textarea
          id="repair-description"
          className="input min-h-32 py-3"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Describe the issue and where it is…"
          required
          aria-required="true"
        />
        <Button
          className="mt-4 w-full"
          loading={processing}
          disabled={!description.trim()}
          onClick={() => submit(category, description.trim())}
        >
          Submit request
        </Button>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Wrench;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="empty-icon">
          <Icon />
        </div>
        <div className="font-semibold">{title}</div>
        <p className="max-w-xs text-sm text-muted">{description}</p>
        {action}
      </CardContent>
    </Card>
  );
}
