"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { CircleAlert } from "lucide-react"
import { useTranslations } from "next-intl"

import { TextField } from "@/components/form-fields"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { signInAction } from "@/server/actions/auth"

import { PasswordField } from "./password-input"

export function SignInForm() {
  const t = useTranslations("auth.signIn")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          setError(null)
          // On success the action opens the app; it only returns when signing in failed.
          const result = await signInAction({ email, password })
          setError(result.error)
        })
      }}
    >
      {error ? (
        <Alert variant="destructive" role="alert">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <FieldGroup>
        <TextField
          label={t("email")}
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          dir="ltr"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField
          label={t("password")}
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          labelExtra={
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t("forgot")}
            </Link>
          }
        />
      </FieldGroup>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Spinner data-icon="inline-start" /> : null}
        {t("submit")}
      </Button>
    </form>
  )
}
