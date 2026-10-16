"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./auth.module.css";
import { useMockAuth } from "@/lib/ui/auth";
import { Button } from "@/components/ui/Button";
import { Field, PasswordField, TextInput } from "@/components/ui/Field";
import { Monogram } from "@/components/ui/Monogram";
import { AlertTriangleIcon } from "@/components/ui/icons";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  email?: string;
  password?: string;
}

/**
 * Mock sign-in form. There is no account backend: validation is shape-only
 * (email format, 8+ character password), and the demo mode is disclosed
 * inline. Credentials are used for validation and discarded — never stored,
 * logged, or transmitted.
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
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div>
          <div className={styles.brandRow}>
            <Monogram size={30} />
            <span className={styles.brandName}>Haven</span>
          </div>
          <h1 className={styles.title}>Sign in</h1>
          <p className={styles.subtitle}>
            Your private two-person messenger. This build is an interface
            prototype.
          </p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {formError ? (
            <p className={styles.formError} role="alert">
              <AlertTriangleIcon size={15} />
              {formError}
            </p>
          ) : null}

          <Field label="Email" htmlFor="login-email" error={errors.email}>
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
          </Field>

          <PasswordField
            label="Password"
            id="login-password"
            name="password"
            autoComplete="current-password"
            placeholder="At least 8 characters"
            value={password}
            error={errors.password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password)
                setErrors((prev) => ({ ...prev, password: undefined }));
            }}
          />

          <Button type="submit" loading={signingIn}>
            {signingIn ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className={styles.footer}>
          Demo mode — any email with a password of 8+ characters is accepted.
          Nothing is stored or sent anywhere.
        </p>
      </div>
    </div>
  );
}
