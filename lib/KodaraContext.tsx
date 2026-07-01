"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  addDocument as persistDocument,
  createMaintenanceRequest,
  createProperty,
  createTenant,
  createUnit,
  getCurrentDemoUser,
  getDocuments,
  getMaintenanceRequests,
  getMessages,
  getPayments,
  getProperties,
  getTenants,
  getUnits,
  isUsingDemoFallback,
  payCurrentTenantRent,
  resetFullDemo,
  sendMessage as persistMessage,
  sendRentReminder as persistRentReminder,
  setDemoUserRole,
  subscribeToTable,
  updateMaintenanceStatus,
} from "./kodara-service";
import { isSupabaseConfigured } from "./supabase";
import type {
  DocumentRecord,
  KodaraUser,
  MaintenanceRequest,
  MaintenanceView,
  Message,
  PaymentView,
  Property,
  Role,
  TenantView,
  Unit,
} from "./types";

type KodaraContextValue = {
  currentUser: KodaraUser;
  role: Role;
  properties: Property[];
  units: Unit[];
  tenants: TenantView[];
  maintenance: MaintenanceView[];
  payments: PaymentView[];
  messages: Message[];
  documents: DocumentRecord[];
  selectedPropertyId: string | null;
  tenantBalance: number;
  currentTenant: TenantView | undefined;
  isLoading: boolean;
  loadError: string | null;
  supabaseConnected: boolean;
  usingDemo: boolean;
  refreshData: () => Promise<void>;
  selectProperty: (id: string | null) => void;
  switchToUser: (role: Role) => void;
  addProperty: (input: {
    name: string;
    address: string;
    propertyType?: Property["property_type"];
  }) => Promise<void>;
  addUnit: (input: {
    propertyId: string;
    name: string;
    rent: number;
    status?: Unit["status"];
  }) => Promise<void>;
  addTenant: (input: {
    unitId: string;
    name: string;
    phone: string;
  }) => Promise<void>;
  submitMaintenance: (input: {
    category: string;
    description: string;
    tenantId?: string;
    unitId?: string;
  }) => Promise<void>;
  updateMaintenance: (
    id: string,
    status: MaintenanceRequest["status"],
  ) => Promise<void>;
  payRent: () => Promise<PaymentView | null>;
  sendMessage: (input: {
    receiverId: string;
    receiverName: string;
    subject: string;
    content: string;
  }) => Promise<void>;
  addDocument: (input: {
    name: string;
    type: DocumentRecord["type"];
    propertyId: string | null;
    tenantId: string | null;
    sizeBytes: number;
  }) => Promise<void>;
  sendRentReminder: (tenantId: string) => Promise<void>;
  resetDemo: () => Promise<void>;
};

const KodaraContext = createContext<KodaraContextValue | null>(null);

export function KodaraProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("landlord");
  const [currentUser, setCurrentUser] = useState<KodaraUser>(() =>
    getCurrentDemoUser(),
  );
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<TenantView[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceView[]>([]);
  const [payments, setPayments] = useState<PaymentView[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [usingDemo, setUsingDemo] = useState(true);
  const supabaseConnected = isSupabaseConfigured();

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        nextProperties,
        nextUnits,
        nextTenants,
        nextMaintenance,
        nextPayments,
        nextMessages,
        nextDocuments,
      ] = await Promise.all([
        getProperties(),
        getUnits(),
        getTenants(),
        getMaintenanceRequests(),
        getPayments(),
        getMessages(),
        getDocuments(),
      ]);
      setProperties(nextProperties);
      setUnits(nextUnits);
      setTenants(nextTenants);
      setMaintenance(nextMaintenance);
      setPayments(nextPayments);
      setMessages(nextMessages);
      setDocuments(nextDocuments);
      setSelectedPropertyId(
        (current) => current ?? nextProperties[0]?.id ?? null,
      );
      setUsingDemo(isUsingDemoFallback());
      setLoadError(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not load your workspace data. Check your connection and try again.";
      setLoadError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refreshData(), 0);
    if (!supabaseConnected) return () => window.clearTimeout(initial);
    const refresh = () => void refreshData();
    const unsubscribe = [
      subscribeToTable("payments", refresh),
      subscribeToTable("maintenance_requests", refresh),
      subscribeToTable("messages", refresh),
    ];
    return () => {
      window.clearTimeout(initial);
      unsubscribe.forEach((stop) => stop());
    };
  }, [refreshData, supabaseConnected]);

  const switchToUser = (nextRole: Role) => {
    setDemoUserRole(nextRole);
    setRole(nextRole);
    setCurrentUser(getCurrentDemoUser());
  };

  const value = useMemo<KodaraContextValue>(
    () => ({
      currentUser,
      role,
      properties,
      units,
      tenants,
      maintenance,
      payments,
      messages,
      documents,
      selectedPropertyId,
      tenantBalance:
        tenants.find((item) => item.user_id === currentUser.id)
          ?.outstanding_balance ?? 0,
      currentTenant: tenants.find((item) => item.user_id === currentUser.id),
      isLoading,
      loadError,
      supabaseConnected,
      usingDemo,
      refreshData,
      selectProperty: setSelectedPropertyId,
      switchToUser,
      addProperty: async (input) => {
        await createProperty({
          name: input.name,
          address: input.address,
          property_type: input.propertyType ?? "apartment",
        });
        await refreshData();
      },
      addUnit: async (input) => {
        await createUnit({
          property_id: input.propertyId,
          unit_name: input.name,
          monthly_rent: input.rent,
          status: input.status ?? "vacant",
        });
        await refreshData();
      },
      addTenant: async (input) => {
        await createTenant({
          unit_id: input.unitId,
          full_name: input.name,
          phone: input.phone,
        });
        await refreshData();
      },
      submitMaintenance: async (input) => {
        const fallbackTenant =
          tenants.find((item) => item.user_id === currentUser.id) ??
          tenants[0];
        if (!fallbackTenant)
          throw new Error("No tenant is available for this request");
        await createMaintenanceRequest({
          unit_id: input.unitId ?? fallbackTenant.unit_id,
          tenant_id: input.tenantId ?? fallbackTenant.id,
          category: input.category,
          description: input.description,
        });
        await refreshData();
      },
      updateMaintenance: async (id, status) => {
        await updateMaintenanceStatus(id, status);
        await refreshData();
      },
      payRent: async () => {
        const activeTenant = tenants.find(
          (item) => item.user_id === currentUser.id,
        );
        if (!activeTenant) {
          throw new Error("No tenant record found for this account");
        }
        const result = await payCurrentTenantRent(activeTenant.id);
        await refreshData();
        return result;
      },
      sendMessage: async (input) => {
        await persistMessage({
          receiver_id: input.receiverId,
          receiver_name: input.receiverName,
          subject: input.subject,
          content: input.content,
        });
        await refreshData();
      },
      addDocument: async (input) => {
        await persistDocument({
          name: input.name,
          type: input.type,
          property_id: input.propertyId,
          tenant_id: input.tenantId,
          size_bytes: input.sizeBytes,
        });
        await refreshData();
      },
      sendRentReminder: async (tenantId) => {
        await persistRentReminder(tenantId);
        await refreshData();
      },
      resetDemo: async () => {
        resetFullDemo();
        await refreshData();
      },
    }),
    [
      currentUser,
      documents,
      isLoading,
      loadError,
      maintenance,
      messages,
      payments,
      properties,
      refreshData,
      role,
      selectedPropertyId,
      supabaseConnected,
      tenants,
      units,
      usingDemo,
    ],
  );

  return (
    <KodaraContext.Provider value={value}>{children}</KodaraContext.Provider>
  );
}

export function useKodara(): KodaraContextValue {
  const value = useContext(KodaraContext);
  if (!value) throw new Error("useKodara must be used within KodaraProvider");
  return value;
}
