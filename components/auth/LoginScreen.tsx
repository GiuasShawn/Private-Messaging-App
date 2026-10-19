"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./auth.module.css";
import { useMockAuth } from "@/lib/ui/auth";
import { Field, PasswordField, TextInput } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import {
  AlertTriangleIcon,
  EyeIcon,
  LockIcon,
  MessageIcon,
  ShieldIcon,
} from "@/components/ui/icons";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  email?: string;
  password?: string;
}

/** Brand glyph from the supplied Haven designs: two nodes joined by a channel. */
function BrandGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size * 1.7}
      height={size * 0.6}
      viewBox="0 0 34 12"
      fill="none"
      aria-hidden
      focusable="false"
    >
      <circle cx="5" cy="6" r="4" fill="#a78bfa" />
      <rect x="9" y="5.5" width="9" height="1" fill="#71717a" />
      <circle cx="24" cy="6" r="4" fill="#e5e1e4" />
    </svg>
  );
}

/**
 * Mock sign-in form styled to the supplied Haven login design. There is no
 * account backend: validation is shape-only (email format, 8+ character
 * password), and the demo mode is disclosed inline. Credentials are used for
 * validation and discarded — never stored, logged, or transmitted.
 */
export function LoginScreen() {
  const router = useRouter();
  const { user, signingIn, signIn } = useMockAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Already signed in (e.g. navigating back to /login) → return to the app.
  useEffect(() => {
    if (user) router.replace("/chat");
  }, [user, router]);

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!EMAIL_PATTERN.test(email.trim())) {
      next.email = "Enter a valid email address.";
    }
    if (password.length < 8) {
      next.password = "Password must be at least 8 characters.";
    }
    return next;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const nextErrors = validate();
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;

    const result = await signIn(email, password);
    if (result.ok) {
      router.replace("/chat");
    } else {
      setFormError(result.message);
    }
  };

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.tunnelBadge}>
          <span className={styles.tunnelLeft}>
            <span className={styles.tunnelDot} aria-hidden />
            <span className={styles.tunnelLabel}>E2EE tunnel</span>
          </span>
          <span className={styles.tunnelKey} title="Simulated session fingerprint">
            0x7B..92F4
          </span>
        </div>

        <header className={styles.brandHeader}>
          <span className={styles.logoTile} aria-hidden>
            <BrandGlyph size={18} />
          </span>
          <h1 className={styles.brandName}>haven</h1>
          <p className={styles.brandTagline}>A private space for two.</p>
        </header>

        <div className={styles.formIntro}>
          <h2 className={styles.formTitle}>Welcome back</h2>
          <p className={styles.formSubtitle}>
            Sign in to continue to your private space.
          </p>
        </div>

        {formError ? (
          <p className={styles.formError} role="alert">
            <AlertTriangleIcon size={15} />
            <span>
              <strong>Authentication failed</strong>
              <span className={styles.formErrorDetail}>{formError}</span>
            </span>
          </p>
        ) : null}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <Field label="Email" htmlFor="login-email" error={errors.email}>
            <span className={styles.inputWrap}>
              <TextInput
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "login-email-error" : undefined}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                }}
              />
              <span className={styles.inputIcon} aria-hidden>
                <MessageIcon size={15} />
              </span>
            </span>
          </Field>

          <div className={styles.passwordBlock}>
            <PasswordField
              label="Password"
              id="login-password"
              name="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              error={errors.password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password)
                  setErrors((prev) => ({ ...prev, password: undefined }));
              }}
            />
            <Link href="/recovery" className={styles.forgotLink}>
              Forgot password?
            </Link>
          </div>

          <button type="submit" className={styles.submit} disabled={signingIn}>
            {signingIn ? "Connecting…" : "Sign in"}
            {signingIn ? <Spinner size={16} /> : null}
          </button>
        </form>

        <div className={styles.protocolStrip}>
          <span>
            <LockIcon size={13} />
            Signal Protocol v3 · simulated
          </span>
          <span>
            <ShieldIcon size={13} />
            Zero server retention
          </span>
        </div>

        <footer className={styles.footer}>
          <EyeIcon size={13} className={styles.footerIcon} />
          <span>End-to-end encryption arrives in a later phase.</span>
        </footer>

        <p className={styles.demoNote}>
          Demo mode — any email with a password of 8+ characters is accepted.
          Nothing is stored or sent anywhere.
        </p>
      </div>

      <p className={styles.counterpart}>
        <span className={styles.counterpartDot} aria-hidden />
        Connected counterpart: simulated
        <span className={styles.counterpartId}>ID: #02-PAIR</span>
      </p>
    </main>
  );
}
