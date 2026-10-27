"use client"

/**
 * Language and appearance: submenus for the account menus, a compact bar for
 * the pages before sign-in, and choices for the account pages. The language is a cookie (server-rendered text
 * and direction); light or dark is kept in the browser by next-themes.
 */
import { useSyncExternalStore, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronDown, Languages, Monitor, Moon, Sun } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { LOCALE_NAMES, LOCALES, type Locale } from "@/i18n/config"
import { setLocaleAction } from "@/server/actions/preferences"

const THEMES = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
] as const

function useLocaleSwitch() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const change = (next: string) =>
    startTransition(async () => {
      await setLocaleAction(next)
      router.refresh()
    })
  return { change, pending }
}

/** "Language" and "Appearance" submenus for a dropdown menu. */
export function PreferencesSubmenus() {
  const t = useTranslations("prefs")
  const locale = useLocale()
  const { theme = "system", setTheme } = useTheme()
  const { change } = useLocaleSwitch()
  const current = THEMES.find((x) => x.value === theme) ?? THEMES[2]
  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Languages />
          {t("language")}
          <span className="ms-auto ps-3 text-xs font-normal tracking-normal text-muted-foreground normal-case">
            {LOCALE_NAMES[locale]}
          </span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup value={locale} onValueChange={change}>
            {LOCALES.map((l) => (
              <DropdownMenuRadioItem key={l} value={l} lang={l} className="normal-case">
                {LOCALE_NAMES[l]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <current.icon />
          {t("appearance")}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
            {THEMES.map((x) => (
              <DropdownMenuRadioItem key={x.value} value={x.value}>
                <x.icon />
                {t(x.value)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  )
}

/** The stored theme is only known in the browser; until then the trigger shows "like the device". */
const subscribe = () => () => {}
const useMounted = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )

/** Language and appearance as two small menus, for the sign-in and registration pages. */
export function PreferencesBar() {
  const t = useTranslations("prefs")
  const locale = useLocale()
  const mounted = useMounted()
  const { theme: stored = "system", setTheme } = useTheme()
  const theme = mounted ? stored : "system"
  const { change, pending } = useLocaleSwitch()
  const current = THEMES.find((x) => x.value === theme) ?? THEMES[2]
  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={pending} aria-label={t("language")}>
            <Languages data-icon="inline-start" />
            <span className="normal-case">{LOCALE_NAMES[locale]}</span>
            <ChevronDown data-icon="inline-end" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {LOCALES.map((l: Locale) => (
            <DropdownMenuItem key={l} lang={l} onSelect={() => change(l)} className="normal-case">
              {LOCALE_NAMES[l]}
              {l === locale ? <Check className="ms-auto" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t("appearance")}>
            <current.icon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {THEMES.map((x) => (
            <DropdownMenuItem key={x.value} onSelect={() => setTheme(x.value)}>
              <x.icon />
              {t(x.value)}
              {x.value === theme ? <Check className="ms-auto" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/** Language and appearance as two sets of choices, for the account pages. */
export function PreferencesFields() {
  const t = useTranslations("prefs")
  const locale = useLocale()
  const mounted = useMounted()
  const { theme: stored = "system", setTheme } = useTheme()
  const theme = mounted ? stored : "system"
  const { change, pending } = useLocaleSwitch()
  return (
    <div className="grid gap-6 border p-5 sm:grid-cols-2">
      <fieldset className="flex flex-col gap-3" disabled={pending}>
        <legend className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Languages className="size-4 text-muted-foreground" aria-hidden="true" />
          {t("language")}
        </legend>
        <RadioGroup value={locale} onValueChange={change} className="gap-2">
          {LOCALES.map((l) => (
            <label key={l} className="flex cursor-pointer items-center gap-2 text-sm" lang={l}>
              <RadioGroupItem value={l} />
              {LOCALE_NAMES[l]}
            </label>
          ))}
        </RadioGroup>
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Sun className="size-4 text-muted-foreground" aria-hidden="true" />
          {t("appearance")}
        </legend>
        <RadioGroup value={theme} onValueChange={setTheme} className="gap-2">
          {THEMES.map((x) => (
            <label key={x.value} className="flex cursor-pointer items-center gap-2 text-sm">
              <RadioGroupItem value={x.value} />
              <x.icon className="size-4 text-muted-foreground" aria-hidden="true" />
              {t(x.value)}
            </label>
          ))}
        </RadioGroup>
      </fieldset>
    </div>
  )
}
