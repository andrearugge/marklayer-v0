import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "./profile-form";
import { Separator } from "@/components/ui/separator";

export default async function ProfilePage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: currentUser.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      createdAt: true,
      password: true,
      accounts: { select: { provider: true } },
    },
  });

  if (!user) redirect("/login");

  const { password, accounts, ...profile } = user;
  const providers: string[] = [
    ...accounts.map((a) => a.provider),
    ...(password ? ["credentials"] : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profilo</h1>
        <p className="text-muted-foreground">
          Gestisci le informazioni del tuo account.
        </p>
      </div>

      <Separator />

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <ProfileForm
          initialName={profile.name ?? ""}
          initialImage={profile.image ?? ""}
          email={profile.email}
        />

        <aside className="space-y-6">
          {/* Account info */}
          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-medium">Info account</h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-medium">{profile.email}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Membro dal</dt>
                <dd className="font-medium">
                  {new Date(profile.createdAt).toLocaleDateString("it-IT", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </dd>
              </div>
            </dl>
          </div>

          {/* Connected providers */}
          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-medium">Provider collegati</h3>
            {providers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuno</p>
            ) : (
              <ul className="space-y-2">
                {providers.map((provider) => (
                  <li
                    key={provider}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold uppercase">
                      {provider[0]}
                    </span>
                    <span className="capitalize">{provider}</span>
                    <span className="ml-auto text-xs text-green-600 font-medium">
                      Collegato
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
