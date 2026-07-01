import { KodaraApp } from "./components/KodaraApp";

type PageProps = { searchParams: Promise<{ role?: string }> };

export default async function Page({ searchParams }: PageProps) {
  const { role } = await searchParams;
  return (
    <KodaraApp
      initialRole={
        role === "tenant"
          ? "tenant"
          : role === "manager"
            ? "property_manager"
            : "landlord"
      }
    />
  );
}
