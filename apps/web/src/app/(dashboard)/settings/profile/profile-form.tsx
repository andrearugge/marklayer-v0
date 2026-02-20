"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UpdateProfileSchema, type UpdateProfileData } from "@/lib/validations/profile";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle2 } from "lucide-react";

interface ProfileFormProps {
  initialName: string;
  initialImage: string;
  email: string;
}

function getInitials(name: string, email: string) {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email[0].toUpperCase();
}

export function ProfileForm({ initialName, initialImage, email }: ProfileFormProps) {
  const router = useRouter();
  const { update } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<UpdateProfileData>({
    resolver: zodResolver(UpdateProfileSchema),
    defaultValues: {
      name: initialName,
      image: initialImage,
    },
  });

  const watchedImage = form.watch("image");
  const watchedName = form.watch("name");

  async function onSubmit(values: UpdateProfileData) {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const data = await res.json();

    if (!res.ok) {
      setIsLoading(false);
      setError(data.error?.message ?? "Errore durante il salvataggio.");
      return;
    }

    // Refresh the session so UserButton reflects the new name/image
    await update();
    setIsLoading(false);
    setSuccess(true);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Avatar preview */}
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={watchedImage || undefined} />
          <AvatarFallback className="text-lg">
            {getInitials(watchedName, email)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">Foto profilo</p>
          <p className="text-xs text-muted-foreground">
            Incolla l&apos;URL di un&apos;immagine nel campo sottostante
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Profilo aggiornato con successo.</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl>
                  <Input placeholder="Mario Rossi" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="image"
            render={({ field }) => (
              <FormItem>
                <FormLabel>URL avatar</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://esempio.com/avatar.jpg"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Lascia vuoto per usare le iniziali del nome.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Salvataggio..." : "Salva modifiche"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
