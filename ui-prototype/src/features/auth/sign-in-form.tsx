"use client"

import { useActionState } from "react"
import Link from "next/link"
import { LogIn } from "lucide-react"
import { useTranslations } from "next-intl"

import { TextField } from "@/components/form-fields"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { signInAction, type SignInState } from "@/server/actions/auth"

import { PasswordField } from "./password-input"

export function SignInForm() {
  const t = useTranslations("auth.signIn")
  const [state, action, pending] = useActionState(
    async (_: SignInState, data: FormData) =>
      signInAction({
        username: String(data.get("username") ?? ""),
        password: String(data.get("password") ?? ""),
      }),
    { error: null }
  )

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <TextField
        name="username"
        label={t("username")}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        dir="ltr"
        required
        autoFocus
      />
      <PasswordField
        name="password"
        label={t("password")}
        autoComplete="current-password"
        required
      />
      <Button type="submit" size="lg" disabled={pending}>
        <LogIn data-icon="inline-start" />
        {t("submit")}
      </Button>
      <p className="text-sm text-muted-foreground">{t("forgot")}</p>
      <p className="text-xs text-muted-foreground">
        {t.rich("demo", {
          link: (chunks) => (
            <Link
              href="/sign-in/demo"
              className="font-medium text-foreground underline underline-offset-4"
            >
              {chunks}
            </Link>
          ),
        })}
      </p>
    </form>
  )
}
