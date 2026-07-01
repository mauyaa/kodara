"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Clock3,
  Download,
  FileText,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useKodara } from "@/lib/KodaraContext";
import type {
  DocumentRecord,
  MaintenanceRequest,
  MaintenanceView,
  TenantView,
  Unit,
} from "@/lib/types";
import { formatDate, formatKES } from "@/lib/utils";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card, CardContent, CardHeader } from "./ui/Card";

export type WorkspaceView =
  | "dashboard"
  | "properties"
  | "tenants"
  | "payments"
  | "maintenance"
  | "messages"
  | "documents"
  | "reports";
type Modal = "property" | "unit" | "tenant" | "message" | "document" | null;

const viewCopy: Record<
  WorkspaceView,
  { eyebrow: string; title: string; description: string }
> = {
  dashboard: {
    eyebrow: "Monday, 29 June",
    title: "Good morning, Peter.",
    description: "Your portfolio is healthy. Two items need attention today.",
  },
  properties: {
    eyebrow: "Portfolio",
    title: "Properties & units",
    description: "Manage inventory, rent, occupancy, and property details.",
  },
  tenants: {
    eyebrow: "People",
    title: "Tenant directory",
    description: "Track leases, balances, contacts, and tenant actions.",
  },
  payments: {
    eyebrow: "Money",
    title: "Rent collection",
    description: "A complete, auditable view of M-Pesa and manual collections.",
  },
  maintenance: {
    eyebrow: "Operations",
    title: "Maintenance desk",
    description: "Triage requests, assign work, and keep tenants informed.",
  },
  messages: {
    eyebrow: "Communication",
    title: "Unified inbox",
    description: "Keep every property conversation in one accountable place.",
  },
  documents: {
    eyebrow: "Records",
    title: "Document vault",
    description: "Leases, receipts, inspections, and tenant records.",
  },
  reports: {
    eyebrow: "Insights",
    title: "Portfolio reports",
    description:
      "Collection, occupancy, and operating performance at a glance.",
  },
};

export function PortfolioWorkspace({
  view,
  onNavigate,
}: {
  view: WorkspaceView;
  onNavigate: (view: WorkspaceView) => void;
}) {
  const data = useKodara();
  const [modal, setModal] = useState<Modal>(null);
  const copy =
    view === "dashboard"
      ? {
          ...viewCopy.dashboard,
          eyebrow: new Date().toLocaleDateString("en-KE", {
            weekday: "long",
            day: "numeric",
            month: "long",
          }),
          title: `Good ${timeOfDayGreeting()}, ${data.currentUser.full_name.split(" ")[0]}.`,
          description:
            data.maintenance.filter((item) => item.status !== "completed")
              .length > 0 ||
            data.tenants.some((item) => item.outstanding_balance > 0)
              ? "Your portfolio needs a little attention today."
              : "Your portfolio is healthy. Nothing needs attention today.",
        }
      : viewCopy[view];

  return (
    <div className="workspace-page">
      <div className="workspace-heading">
        <div>
          <div className="workspace-eyebrow">{copy.eyebrow}</div>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {view === "properties" && (
            <Button onClick={() => setModal("property")}>
              <Plus size={15} />
              Add property
            </Button>
          )}
          {view === "tenants" && (
            <Button onClick={() => setModal("tenant")}>
              <Plus size={15} />
              Add tenant
            </Button>
          )}
          {view === "payments" && (
            <Button
              variant="secondary"
              disabled={data.payments.length === 0}
              onClick={() => exportPayments(data.payments)}
            >
              <Download size={15} />
              Export CSV
            </Button>
          )}
          {view === "messages" && (
            <Button onClick={() => setModal("message")}>
              <Plus size={15} />
              New message
            </Button>
          )}
          {view === "documents" && (
            <Button onClick={() => setModal("document")}>
              <Upload size={15} />
              Add document
            </Button>
          )}
        </div>
      </div>

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

      {data.isLoading ? (
        <LoadingState />
      ) : (
        <>
          {view === "dashboard" &&
            (data.properties.length === 0 ? (
              <PortfolioEmptyState
                icon={Building2}
                title="Welcome to Kodara"
                description="Add your first property to start tracking units, tenants, and rent collection."
              />
            ) : (
              <Dashboard data={data} onNavigate={onNavigate} />
            ))}
          {view === "properties" && (
            <Properties data={data} onAddUnit={() => setModal("unit")} />
          )}
          {view === "tenants" && <Tenants data={data} />}
          {view === "payments" && <Payments data={data} />}
          {view === "maintenance" && <Maintenance data={data} />}
          {view === "messages" && (
            <Messages data={data} onCompose={() => setModal("message")} />
          )}
          {view === "documents" && <Documents data={data} />}
          {view === "reports" && <Reports data={data} />}
        </>
      )}

      {modal && (
        <ActionModal kind={modal} close={() => setModal(null)} data={data} />
      )}
    </div>
  );
}

type KodaraData = ReturnType<typeof useKodara>;

function Dashboard({
  data,
  onNavigate,
}: {
  data: KodaraData;
  onNavigate: (view: WorkspaceView) => void;
}) {
  const occupied = data.units.filter(
    (unit) => unit.status === "occupied",
  ).length;
  const rentable = data.units.filter(
    (unit) => unit.status !== "maintenance",
  ).length;
  const completed = data.payments.filter(
    (payment) => payment.status === "completed",
  );
  const collected = completed.reduce((sum, payment) => sum + payment.amount, 0);
  const outstanding = data.tenants.reduce(
    (sum, tenant) => sum + tenant.outstanding_balance,
    0,
  );
  const occupancy = rentable ? Math.round((occupied / rentable) * 100) : 0;
  const collectionTarget = collected + outstanding;
  const collectionRate = collectionTarget
    ? Math.round((collected / collectionTarget) * 100)
    : 100;

  const tenantsNeedingFollowUp = data.tenants.filter(
    (item) => item.outstanding_balance > 0,
  ).length;
  const openMaintenance = data.maintenance.filter(
    (item) => item.status !== "completed",
  );
  const highPriorityCount = openMaintenance.filter(
    (item) => item.priority === "high" || item.priority === "emergency",
  ).length;

  const stats = [
    {
      label: "Collected this month",
      value: formatKES(collected),
      helper: `${collectionRate}% collection rate`,
      icon: ArrowUpRight,
      tone: "positive",
    },
    {
      label: "Outstanding",
      value: formatKES(outstanding),
      helper:
        tenantsNeedingFollowUp === 0
          ? "All tenants are up to date"
          : `${tenantsNeedingFollowUp} ${tenantsNeedingFollowUp === 1 ? "tenant" : "tenants"} need follow-up`,
      icon: ArrowDownRight,
      tone: "warning",
    },
    {
      label: "Occupancy",
      value: `${occupancy}%`,
      helper: `${occupied} of ${rentable} rentable units`,
      icon: Building2,
      tone: "neutral",
    },
    {
      label: "Open maintenance",
      value: String(openMaintenance.length),
      helper:
        highPriorityCount === 0
          ? "None high priority"
          : `${highPriorityCount} high priority`,
      icon: Wrench,
      tone: "neutral",
    },
  ];

  return (
    <>
      <div className="metrics-grid">
        {stats.map(({ label, value, helper, icon: Icon, tone }) => (
          <Card key={label} className="metric-card">
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="metric-label">{label}</span>
                <span className={`metric-icon ${tone}`}>
                  <Icon size={16} />
                </span>
              </div>
              <div className="metric-value">{value}</div>
              <div className="metric-helper">{helper}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.45fr_.8fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="card-title">Collection pulse</div>
                <div className="card-subtitle">
                  June 2026 across your portfolio
                </div>
              </div>
              <button
                className="text-link"
                onClick={() => onNavigate("reports")}
              >
                View report
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div
              className="collection-chart"
              aria-label={`${collectionRate}% collected`}
            >
              <div className="chart-copy">
                <strong>{collectionRate}%</strong>
                <span>of expected rent collected</span>
              </div>
              <div className="progress-track">
                <span style={{ width: `${collectionRate}%` }} />
              </div>
              <div className="mt-6 grid grid-cols-3 gap-4 border-t pt-5">
                <MiniMetric
                  label="Expected"
                  value={formatKES(collectionTarget)}
                />
                <MiniMetric label="Received" value={formatKES(collected)} />
                <MiniMetric label="At risk" value={formatKES(outstanding)} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="card-title">Needs attention</div>
            <div className="card-subtitle">Prioritized by urgency</div>
          </CardHeader>
          <CardContent className="space-y-3">
            {outstanding > 0 && (
              <Attention
                icon={Clock3}
                title="Rent overdue"
                detail={`${data.tenants.find((item) => item.outstanding_balance > 0)?.full_name} · ${formatKES(data.tenants.find((item) => item.outstanding_balance > 0)?.outstanding_balance ?? 0)}`}
                onClick={() => onNavigate("tenants")}
              />
            )}
            {data.maintenance
              .filter((item) => item.status !== "completed")
              .slice(0, 2)
              .map((item) => (
                <Attention
                  key={item.id}
                  icon={Wrench}
                  title={item.title}
                  detail={`${item.property_name} · Unit ${item.unit_name}`}
                  onClick={() => onNavigate("maintenance")}
                />
              ))}
          </CardContent>
        </Card>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <Card>
          <CardHeader>
            <div className="flex justify-between">
              <div>
                <div className="card-title">Recent payments</div>
                <div className="card-subtitle">
                  Verified collection activity
                </div>
              </div>
              <button
                className="text-link"
                onClick={() => onNavigate("payments")}
              >
                All payments
              </button>
            </div>
          </CardHeader>
          <PaymentTable payments={data.payments.slice(0, 4)} />
        </Card>
        <Card>
          <CardHeader>
            <div className="card-title">Portfolio occupancy</div>
            <div className="card-subtitle">Unit distribution by property</div>
          </CardHeader>
          <CardContent className="space-y-5">
            {data.properties.map((property) => {
              const units = data.units.filter(
                (unit) => unit.property_id === property.id,
              );
              const used = units.filter(
                (unit) => unit.status === "occupied",
              ).length;
              const percent = units.length
                ? Math.round((used / units.length) * 100)
                : 0;
              return (
                <div key={property.id}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="font-medium">{property.name}</span>
                    <span className="text-muted">
                      {used}/{units.length} occupied
                    </span>
                  </div>
                  <div className="progress-track small">
                    <span style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Properties({
  data,
  onAddUnit,
}: {
  data: KodaraData;
  onAddUnit: () => void;
}) {
  if (data.properties.length === 0) {
    return (
      <PortfolioEmptyState
        icon={Building2}
        title="No properties yet"
        description="Add your first property to start tracking units, tenants, and rent collection."
      />
    );
  }
  return (
    <div className="space-y-5">
      {data.properties.map((property) => {
        const units = data.units.filter(
          (unit) => unit.property_id === property.id,
        );
        const occupied = units.filter(
          (unit) => unit.status === "occupied",
        ).length;
        return (
          <Card key={property.id}>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="property-icon">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <div className="card-title">{property.name}</div>
                    <div className="card-subtitle">{property.address}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="success">
                    {occupied}/{units.length} occupied
                  </Badge>
                <button
                  className="icon-button"
                  aria-label={`More actions for ${property.name}`}
                >
                    <MoreHorizontal size={17} />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="responsive-table">
                <table>
                  <thead>
                    <tr>
                      <th>Unit</th>
                      <th>Status</th>
                      <th>Rent</th>
                      <th>Floor</th>
                      <th>Tenant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((unit) => {
                      const tenant = data.tenants.find(
                        (item) => item.unit_id === unit.id,
                      );
                      return (
                        <tr key={unit.id}>
                          <td className="font-semibold">{unit.unit_name}</td>
                          <td>
                            <StatusBadge value={unit.status} />
                          </td>
                          <td>{formatKES(unit.monthly_rent)}</td>
                          <td>{unit.floor || "Ground"}</td>
                          <td>
                            {tenant?.full_name ?? (
                              <span className="text-muted">Not assigned</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button
                onClick={() => {
                  data.selectProperty(property.id);
                  onAddUnit();
                }}
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent-dark)]"
              >
                <Plus size={14} />
                Add unit
              </button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Tenants({ data }: { data: KodaraData }) {
  const [query, setQuery] = useState("");
  const filtered = data.tenants.filter((tenant) =>
    `${tenant.full_name} ${tenant.phone} ${tenant.property_name}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  if (data.tenants.length === 0) {
    return (
      <PortfolioEmptyState
        icon={Search}
        title="No tenants yet"
        description="Add a tenant from the Tenants tab once a unit is occupied."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="search-box">
          <Search size={16} />
          <label className="sr-only" htmlFor="tenant-search">
            Search tenants, phone, or property
          </label>
          <input
            id="tenant-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tenants, phone, or property"
          />
        </div>
      </CardHeader>
      {filtered.length === 0 ? (
        <CardContent>
          <p className="text-center text-sm text-muted">
            No tenants match &ldquo;{query}&rdquo;.
          </p>
        </CardContent>
      ) : (
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Home</th>
                <th>Lease</th>
                <th>Balance</th>
                <th>Last payment</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((tenant) => (
                <tr key={tenant.id}>
                  <td>
                    <div className="font-semibold">{tenant.full_name}</div>
                    <div className="text-xs text-muted">{tenant.phone}</div>
                  </td>
                  <td>
                    {tenant.property_name}
                    <div className="text-xs text-muted">
                      Unit {tenant.unit_name}
                    </div>
                  </td>
                  <td>
                    <Badge variant="success">Active</Badge>
                  </td>
                  <td
                    className={
                      tenant.outstanding_balance > 0
                        ? "font-semibold text-[var(--warning)]"
                        : "font-semibold text-[var(--success)]"
                    }
                  >
                    {tenant.outstanding_balance
                      ? formatKES(tenant.outstanding_balance)
                      : "Paid"}
                  </td>
                  <td>
                    {tenant.last_payment_date
                      ? formatDate(tenant.last_payment_date)
                      : "—"}
                  </td>
                  <td>
                    {tenant.outstanding_balance > 0 && (
                      <RemindButton tenant={tenant} data={data} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Payments({ data }: { data: KodaraData }) {
  const received = data.payments
    .filter((item) => item.status === "completed")
    .reduce((sum, item) => sum + item.amount, 0);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Summary
          label="Received"
          value={formatKES(received)}
          sub="Verified transactions"
        />
        <Summary
          label="Pending"
          value={formatKES(
            data.tenants.reduce(
              (sum, item) => sum + item.outstanding_balance,
              0,
            ),
          )}
          sub="Requires follow-up"
        />
        <Summary label="M-Pesa success" value="98.7%" sub="Rolling 30 days" />
      </div>
      <Card className="mt-5">
        <CardHeader>
          <div className="card-title">Transaction ledger</div>
          <div className="card-subtitle">
            Every payment is tied to a tenant and unit
          </div>
        </CardHeader>
        {data.payments.length === 0 ? (
          <CardContent>
            <p className="text-center text-sm text-muted">
              No payments recorded yet. Completed M-Pesa and manual payments
              will appear here.
            </p>
          </CardContent>
        ) : (
          <PaymentTable payments={data.payments} />
        )}
      </Card>
    </>
  );
}

function Maintenance({ data }: { data: KodaraData }) {
  const groups: Array<{
    label: string;
    statuses: MaintenanceRequest["status"][];
  }> = [
    { label: "New", statuses: ["submitted", "in_review"] },
    { label: "In progress", statuses: ["approved", "assigned", "in_progress"] },
    { label: "Completed", statuses: ["completed"] },
  ];
  if (data.maintenance.length === 0) {
    return (
      <PortfolioEmptyState
        icon={Wrench}
        title="No maintenance requests"
        description="Tenant repair requests will show up here so you can triage and assign work."
      />
    );
  }
  return (
    <div className="maintenance-board">
      {groups.map((group) => (
        <div key={group.label} className="maintenance-column">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-semibold">{group.label}</div>
            <span className="nav-count">
              {
                data.maintenance.filter((item) =>
                  group.statuses.includes(item.status),
                ).length
              }
            </span>
          </div>
          {data.maintenance
            .filter((item) => group.statuses.includes(item.status))
            .map((item) => (
              <Card key={item.id} className="maintenance-ticket">
                <CardContent>
                  <div className="mb-3 flex items-center justify-between">
                    <Badge
                      variant={
                        item.priority === "high"
                          ? "warning"
                          : item.status === "completed"
                            ? "success"
                            : "teal"
                      }
                    >
                      {item.priority} priority
                    </Badge>
                    <span className="text-xs text-muted">
                      {formatDate(item.created_at)}
                    </span>
                  </div>
                  <div className="font-semibold">{item.title}</div>
                  <p className="mt-1 text-sm text-muted">{item.description}</p>
                  <div className="mt-4 border-t pt-3 text-xs">
                    <div className="font-medium">{item.tenant_name}</div>
                    <div className="text-muted">
                      {item.property_name} · Unit {item.unit_name}
                    </div>
                  </div>
                  {item.status !== "completed" && (
                    <MaintenanceActions item={item} data={data} />
                  )}
                </CardContent>
              </Card>
            ))}
        </div>
      ))}
    </div>
  );
}

function Messages({
  data,
  onCompose,
}: {
  data: KodaraData;
  onCompose: () => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader>
          <div className="flex justify-between">
            <div className="card-title">Conversations</div>
            <button className="icon-button" onClick={onCompose}>
              <Plus size={16} />
            </button>
          </div>
        </CardHeader>
        {data.messages.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted lg:hidden">
            No conversations yet. Start a message to reach a tenant.
          </div>
        ) : (
          <div className="divide-y">
            {data.messages.map((message) => (
              <div key={message.id} className="message-row">
                <div className="avatar-small dark">
                  {message.sender_name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2">
                    <span className="truncate font-semibold">
                      {message.sender_name}
                    </span>
                    <span className="text-[11px] text-muted">
                      {new Date(message.created_at).toLocaleTimeString(
                        "en-KE",
                        { hour: "2-digit", minute: "2-digit" },
                      )}
                    </span>
                  </div>
                  <div className="truncate text-xs font-medium">
                    {message.subject}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {message.content}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card className="hidden min-h-[420px] place-items-center lg:grid">
        <div className="max-w-xs text-center">
          <div className="empty-icon">
            <MessageSquare />
          </div>
          <div className="mt-4 font-semibold">
            {data.messages.length === 0
              ? "No conversations yet"
              : "Select a conversation"}
          </div>
          <p className="mt-1 text-sm text-muted">
            Messages and delivery history appear here.
          </p>
          <Button className="mt-5" onClick={onCompose}>
            <Send size={14} />
            Start a message
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Documents({ data }: { data: KodaraData }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="card-title">All documents</div>
            <div className="card-subtitle">
              Access is scoped by workspace and role
            </div>
          </div>
          <Badge variant="teal">{data.documents.length} files</Badge>
        </div>
      </CardHeader>
      {data.documents.length === 0 ? (
        <CardContent>
          <p className="text-center text-sm text-muted">
            No documents yet. Add a lease, receipt, or inspection report to
            get started.
          </p>
        </CardContent>
      ) : (
        <div className="divide-y">
          {data.documents.map((document) => (
            <div key={document.id} className="document-row">
              <div className="document-icon">
                <FileText size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{document.name}</div>
                <div className="text-xs text-muted">
                  {document.type} · {formatBytes(document.size_bytes)} ·{" "}
                  {formatDate(document.created_at)}
                </div>
              </div>
              <Badge variant="teal">{document.type}</Badge>
              <button
                className="icon-button"
                aria-label={`Download ${document.name}`}
                disabled={!document.file_url}
                title={
                  document.file_url ? "Download" : "Preview metadata only"
                }
              >
                <Download size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Reports({ data }: { data: KodaraData }) {
  const expected = data.units
    .filter((unit) => unit.status === "occupied")
    .reduce((sum, unit) => sum + unit.monthly_rent, 0);
  const received = data.payments
    .filter((item) => item.status === "completed")
    .reduce((sum, item) => sum + item.amount, 0);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Summary
          label="Expected rent"
          value={formatKES(expected)}
          sub="June 2026"
        />
        <Summary
          label="Collected"
          value={formatKES(received)}
          sub={`${expected ? Math.min(100, Math.round((received / expected) * 100)) : 100}% of expected`}
        />
        <Summary
          label="Maintenance exposure"
          value={formatKES(
            data.maintenance.reduce(
              (sum, item) => sum + (item.cost_estimate ?? 0),
              0,
            ),
          )}
          sub="Open estimates"
        />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="card-title">Revenue by property</div>
            <div className="card-subtitle">Completed payments this month</div>
          </CardHeader>
          <CardContent className="space-y-5">
            {data.properties.map((property) => {
              const value = data.payments
                .filter(
                  (item) =>
                    item.property_name === property.name &&
                    item.status === "completed",
                )
                .reduce((sum, item) => sum + item.amount, 0);
              const max = Math.max(
                ...data.properties.map((entry) =>
                  data.payments
                    .filter(
                      (item) =>
                        item.property_name === entry.name &&
                        item.status === "completed",
                    )
                    .reduce((sum, item) => sum + item.amount, 0),
                ),
                1,
              );
              return (
                <div key={property.id}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span>{property.name}</span>
                    <strong>{formatKES(value)}</strong>
                  </div>
                  <div className="progress-track">
                    <span style={{ width: `${(value / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="card-title">Operating health</div>
            <div className="card-subtitle">
              Signals that influence retention
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Health
              label="Rent collection"
              value={
                expected
                  ? Math.min(100, Math.round((received / expected) * 100))
                  : 100
              }
            />
            <Health
              label="Occupancy"
              value={Math.round(
                (data.units.filter((item) => item.status === "occupied")
                  .length /
                  Math.max(data.units.length, 1)) *
                  100,
              )}
            />
            <Health
              label="Maintenance resolution"
              value={Math.round(
                (data.maintenance.filter((item) => item.status === "completed")
                  .length /
                  Math.max(data.maintenance.length, 1)) *
                  100,
              )}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ActionModal({
  kind,
  close,
  data,
}: {
  kind: Exclude<Modal, null>;
  close: () => void;
  data: KodaraData;
}) {
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    try {
      if (kind === "property")
        await data.addProperty({
          name: String(form.get("name")),
          address: String(form.get("address")),
          propertyType: String(form.get("propertyType")) as "apartment",
        });
      if (kind === "unit")
        await data.addUnit({
          propertyId: String(form.get("propertyId")),
          name: String(form.get("name")),
          rent: Number(form.get("rent")),
          status: String(form.get("status")) as Unit["status"],
        });
      if (kind === "tenant") {
        const unitId = String(form.get("unitId") ?? "");
        if (!unitId) {
          toast.error("Add a vacant unit before adding a tenant");
          return;
        }
        const phone = String(form.get("phone") ?? "").trim();
        if (!/^(?:\+?254|0)?[17]\d{8}$/.test(phone)) {
          toast.error("Enter a valid Kenyan phone number");
          return;
        }
        await data.addTenant({
          unitId,
          name: String(form.get("name")),
          phone,
        });
      }
      if (kind === "message") {
        const tenant = data.tenants.find(
          (item) => item.id === String(form.get("tenantId")),
        );
        if (!tenant) {
          toast.error("Choose a recipient before sending");
          return;
        }
        await data.sendMessage({
          receiverId: tenant.user_id,
          receiverName: tenant.full_name,
          subject: String(form.get("subject")),
          content: String(form.get("content")),
        });
      }
      if (kind === "document")
        await data.addDocument({
          name: String(form.get("name")),
          type: String(form.get("type")) as DocumentRecord["type"],
          propertyId: String(form.get("propertyId")) || null,
          tenantId: null,
          sizeBytes: Number(form.get("sizeBytes")) || 0,
        });
      toast.success(`${modalTitle(kind)} saved`);
      close();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save changes",
      );
    } finally {
      setSaving(false);
    }
  };
  const availableUnits = data.units.filter((unit) => unit.status === "vacant");
  return (
    <div className="modal-overlay" onClick={close}>
      <form
        className="modal p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-modal-title"
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="workspace-eyebrow">Kodara workspace</div>
              <h3 id="workspace-modal-title">{modalTitle(kind)}</h3>
          </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Close dialog"
              onClick={close}
            >
            <X size={17} />
          </button>
        </div>
        {kind === "property" && (
          <>
            <Field
              label="Property name"
              name="name"
              placeholder="e.g. Riverside Court"
            />
            <Field label="Address" name="address" placeholder="Town, county" />
            <Select
              label="Property type"
              name="propertyType"
              options={["apartment", "flat", "house", "commercial"]}
            />
          </>
        )}
        {kind === "unit" && (
          <>
            <Select
              label="Property"
              name="propertyId"
              options={data.properties.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
              defaultValue={data.selectedPropertyId ?? ""}
            />
            <Field label="Unit name" name="name" placeholder="e.g. 4B" />
            <Field
              label="Monthly rent (KES)"
              name="rent"
              type="number"
              min={1}
              placeholder="35000"
            />
            <Select
              label="Status"
              name="status"
              options={["vacant", "occupied", "maintenance", "reserved"]}
            />
          </>
        )}
        {kind === "tenant" && (
          <>
            <Field
              label="Full name"
              name="name"
              placeholder="Tenant's legal name"
            />
            <Field
              label="Phone number"
              name="phone"
              type="tel"
              placeholder="+254 7XX XXX XXX"
            />
            {availableUnits.length === 0 ? (
              <p className="mb-4 rounded-[var(--radius-md)] bg-[var(--warning-tint)] p-3 text-xs text-[var(--warning-text)]">
                No vacant units are available. Add a unit first, or mark an
                existing unit as vacant.
              </p>
            ) : (
              <Select
                label="Vacant unit"
                name="unitId"
                options={availableUnits.map((item) => ({
                  value: item.id,
                  label: `${data.properties.find((property) => property.id === item.property_id)?.name} · ${item.unit_name}`,
                }))}
              />
            )}
          </>
        )}
        {kind === "message" && (
          <>
            {data.tenants.length === 0 ? (
              <p className="mb-4 rounded-[var(--radius-md)] bg-[var(--warning-tint)] p-3 text-xs text-[var(--warning-text)]">
                Add a tenant before you can send a message.
              </p>
            ) : (
              <Select
                label="Recipient"
                name="tenantId"
                options={data.tenants.map((item) => ({
                  value: item.id,
                  label: `${item.full_name} · ${item.unit_name}`,
                }))}
              />
            )}
            <Field
              label="Subject"
              name="subject"
              placeholder="What is this about?"
            />
            <label className="label" htmlFor="message-content">
              Message
            </label>
            <textarea
              id="message-content"
              className="input mb-4 min-h-28 py-3"
              name="content"
              required
              aria-required="true"
              placeholder="Write a clear update…"
            />
          </>
        )}
        {kind === "document" && (
          <>
            <Field
              label="Document name"
              name="name"
              placeholder="Lease agreement.pdf"
            />
            <Select
              label="Type"
              name="type"
              options={["lease", "receipt", "inspection", "identity", "other"]}
            />
            <Select
              label="Property"
              name="propertyId"
              options={data.properties.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
            />
            <Field
              label="File size (bytes)"
              name="sizeBytes"
              type="number"
              placeholder="0"
            />
            <p className="mb-4 text-xs text-muted">
              Alpha preview stores document metadata. Production file upload
              requires the Supabase Storage bucket from the deployment guide.
            </p>
          </>
        )}
        <Button className="w-full" loading={saving} type="submit">
          Save {modalTitle(kind).toLowerCase()}
        </Button>
      </form>
    </div>
  );
}

function Field({
  label,
  ...props
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="mb-4">
      <label className="label" htmlFor={props.name}>
        {label}
      </label>
      <input id={props.name} className="input" required {...props} />
    </div>
  );
}
function Select({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: Array<string | { value: string; label: string }>;
  defaultValue?: string;
}) {
  return (
    <div className="mb-4">
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <select
        id={name}
        name={name}
        className="input"
        defaultValue={defaultValue}
      >
        {options.map((option) => {
          const value = typeof option === "string" ? option : option.value;
          return (
            <option key={value} value={value}>
              {typeof option === "string" ? titleCase(option) : option.label}
            </option>
          );
        })}
      </select>
    </div>
  );
}
function RemindButton({
  tenant,
  data,
}: {
  tenant: TenantView;
  data: KodaraData;
}) {
  const [sending, setSending] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={sending}
      onClick={async () => {
        setSending(true);
        try {
          await data.sendRentReminder(tenant.id);
          toast.success(`Reminder queued for ${tenant.full_name}`);
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Could not send the reminder. Please try again.",
          );
        } finally {
          setSending(false);
        }
      }}
    >
      Remind
    </Button>
  );
}
function MaintenanceActions({
  item,
  data,
}: {
  item: MaintenanceView;
  data: KodaraData;
}) {
  const [pending, setPending] = useState<"in_progress" | "completed" | null>(
    null,
  );
  const updateStatus = async (status: "in_progress" | "completed") => {
    setPending(status);
    try {
      await data.updateMaintenance(item.id, status);
      toast.success(
        status === "completed"
          ? "Tenant notified of completion"
          : "Request moved to in progress",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update this request. Please try again.",
      );
    } finally {
      setPending(null);
    }
  };
  return (
    <div className="mt-4 flex gap-2">
      <Button
        size="sm"
        variant="secondary"
        loading={pending === "in_progress"}
        disabled={pending !== null}
        onClick={() => updateStatus("in_progress")}
      >
        In progress
      </Button>
      <Button
        size="sm"
        loading={pending === "completed"}
        disabled={pending !== null}
        onClick={() => updateStatus("completed")}
      >
        Complete
      </Button>
    </div>
  );
}
function PaymentTable({ payments }: { payments: KodaraData["payments"] }) {
  return (
    <div className="responsive-table">
      <table>
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Property</th>
            <th>Amount</th>
            <th>Reference</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td className="font-semibold">{payment.tenant_name}</td>
              <td>
                {payment.property_name}
                <div className="text-xs text-muted">
                  Unit {payment.unit_name}
                </div>
              </td>
              <td className="font-semibold">{formatKES(payment.amount)}</td>
              <td className="font-mono text-xs">
                {payment.mpesa_receipt ?? "Pending"}
              </td>
              <td>
                <StatusBadge value={payment.status} />
              </td>
              <td>{formatDate(payment.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function StatusBadge({ value }: { value: string }) {
  return (
    <Badge
      variant={
        ["completed", "occupied", "active"].includes(value)
          ? "success"
          : ["initiated", "vacant", "submitted"].includes(value)
            ? "warning"
            : "teal"
      }
    >
      {titleCase(value)}
    </Badge>
  );
}
function Summary({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card className="metric-card">
      <CardContent>
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}</div>
        <div className="metric-helper">{sub}</div>
      </CardContent>
    </Card>
  );
}
function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
function Attention({
  icon: Icon,
  title,
  detail,
  onClick,
}: {
  icon: typeof Clock3;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="attention-row">
      <span>
        <Icon size={16} />
      </span>
      <div className="min-w-0 text-left">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="truncate text-xs text-muted">{detail}</div>
      </div>
    </button>
  );
}
function Health({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <div className="progress-track small">
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
function LoadingState() {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      {[1, 2, 3, 4].map((item) => (
        <div className="skeleton h-36" key={item} />
      ))}
    </div>
  );
}
function PortfolioEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Building2;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
        <div className="empty-icon">
          <Icon />
        </div>
        <div className="font-semibold">{title}</div>
        <p className="max-w-sm text-sm text-muted">{description}</p>
      </CardContent>
    </Card>
  );
}
function modalTitle(kind: Exclude<Modal, null>) {
  return {
    property: "Add property",
    unit: "Add unit",
    tenant: "Add tenant",
    message: "New message",
    document: "Add document",
  }[kind];
}
function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function formatBytes(value: number) {
  if (!value) return "Metadata only";
  if (value < 1_000_000) return `${Math.round(value / 1_000)} KB`;
  return `${(value / 1_000_000).toFixed(1)} MB`;
}
function exportPayments(payments: KodaraData["payments"]) {
  const rows = [
    [
      "Date",
      "Tenant",
      "Property",
      "Unit",
      "Amount",
      "Status",
      "M-Pesa reference",
    ],
    ...payments.map((item) => [
      item.created_at,
      item.tenant_name,
      item.property_name,
      item.unit_name,
      String(item.amount),
      item.status,
      item.mpesa_receipt ?? "",
    ]),
  ];
  const blob = new Blob(
    [
      rows
        .map((row) =>
          row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","),
        )
        .join("\n"),
    ],
    { type: "text/csv" },
  );
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "kodara-payments.csv";
  link.click();
  URL.revokeObjectURL(link.href);
  toast.success("Payment report exported");
}
