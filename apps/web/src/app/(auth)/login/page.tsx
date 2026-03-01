import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackUrl, error } = await searchParams;

  // Sanitize: never pass back a URL that would loop to the login/error page.
  // NextAuth may set callbackUrl to the error page URL itself when redirecting
  // after an OAuth failure (e.g. OAuthAccountNotLinked).
  const safeCallbackUrl = (() => {
    const url = callbackUrl ?? "/dashboard";
    if (url.startsWith("/login") || url.startsWith("/register") || url.includes("error=")) {
      return "/dashboard";
    }
    return url;
  })();

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Accedi</CardTitle>
        <CardDescription>
          Accedi al tuo account per continuare
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm callbackUrl={safeCallbackUrl} error={error} />
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          Non hai un account?{" "}
          <Link
            href="/register"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Registrati
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
