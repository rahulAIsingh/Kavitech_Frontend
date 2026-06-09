---
trigger: new_screen, new_component
---

# 07 - Frontend UI / UX Rules

> AI ASSISTANT: Load this file when creating or modifying any UI screen or component.
> Run Section 6 (UI) of `15-ai-self-check.md` before marking any UI task complete.

---

## Core UI Principles

- **Reuse before create**: check if a shared component already exists before building a new one
- **No inline styles**: use class names from the design system; inline style only as documented exception
- **Permission first**: never render a sensitive action without checking permission
- **Responsive from day 1**: every screen works on desktop, tablet, and mobile

---

## Required Component Patterns

### Permission-Aware Action Button

```tsx
// CORRECT — always check permission before rendering sensitive actions:
{hasPermission('orders.order.delete') && (
    <button
        onClick={() => setConfirmDelete(true)}
        disabled={loading}
        aria-label="Delete order"
    >
        Delete
    </button>
)}

// WRONG — no permission check:
<button onClick={deleteOrder}>Delete</button>
```

---

### Async Operation State Pattern (MANDATORY on every async interaction)

```tsx
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [data, setData] = useState<T | null>(null);

const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
        const result = await api.getData();
        setData(result);
    } catch (err: any) {
        // NEVER show raw error.message — use the user-safe field:
        setError(err.response?.data?.message ?? 'An error occurred. Please try again.');
    } finally {
        setLoading(false);
    }
};

// In JSX — handle all three states:
if (loading) return <LoadingSpinner />;
if (error) return <ErrorMessage message={error} correlationId={correlationId} />;
if (!data) return <EmptyState message="No records found" />;
return <DataView data={data} />;
```

---

### Confirmation Dialog (MANDATORY for destructive actions)

```tsx
// WRONG — immediate destructive action:
<button onClick={() => deleteRecord(id)}>Delete</button>

// CORRECT — always confirm first:
const [showConfirm, setShowConfirm] = useState(false);

<button onClick={() => setShowConfirm(true)}>Delete</button>

<ConfirmDialog
    open={showConfirm}
    title="Delete Record"
    message="This action cannot be undone. Are you sure?"
    confirmLabel="Delete"
    onConfirm={() => { deleteRecord(id); setShowConfirm(false); }}
    onCancel={() => setShowConfirm(false)}
    isDangerous={true}
/>
```

---

### Form Submission Pattern

```tsx
// MANDATORY: loading + disabled during submit, field-level error mapping:
const [loading, setLoading] = useState(false);
const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
const [globalError, setGlobalError] = useState<string | null>(null);

const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFieldErrors({});
    setGlobalError(null);
    try {
        await api.save(formData);
        onSuccess();
    } catch (err: any) {
        if (err.response?.data?.errors) {
            // Map server field errors to field-level display:
            const errMap: Record<string, string> = {};
            err.response.data.errors.forEach((e: FieldError) => {
                errMap[e.field] = e.message;
            });
            setFieldErrors(errMap);
        } else {
            setGlobalError(err.response?.data?.message ?? 'Save failed. Please try again.');
        }
    } finally {
        setLoading(false);
    }
};

// Render field error:
<input ... />
{fieldErrors.email && <span className="error">{fieldErrors.email}</span>}
```

---

### Storage Rules for Token / Session Data

```ts
// CORRECT:
// Access token → memory only (React context/state, never localStorage)
// Refresh token → httpOnly cookie (set by server only)
// Non-sensitive UI preferences → localStorage (theme, language, layout)

// WRONG:
localStorage.setItem('access_token', token);   // VIOLATION — exposed to XSS
localStorage.setItem('user_role', role);       // VIOLATION — use JWT claims, not cached role
sessionStorage.setItem('token', token);        // VIOLATION — still XSS-accessible
```

---

## Grid / List Screen Requirements

Every major list screen must support:
- [ ] Search (client or server, documented which)
- [ ] Filter by relevant fields
- [ ] Sort by columns
- [ ] Pagination with page size selector
- [ ] Permission-aware action buttons (Edit, Delete, Archive)
- [ ] Loading state while fetching
- [ ] Empty state ("No records found")
- [ ] Error state with user-safe message

---

## Form Screen Requirements

Every form screen must support:
- [ ] Client-side required field validation before submit
- [ ] Loading disable on submit button while saving
- [ ] Server-side field error mapping to individual fields
- [ ] Global error display for server errors
- [ ] Dirty form warning on navigation away (browser `beforeunload` or React Router prompt)
- [ ] Separate Save, Submit, Approve, Reject actions if workflow states exist

---

## Configuration-Driven UI

The UI must be able to receive from backend (per tenant config):
- Tenant branding (logo, primary color) — from `cfg.BrandingProfile`
- Enabled modules and menu visibility — from `cfg.FeatureFlag`
- Date and time display format — from `cfg.RegionalSettings`
- Localization — from `cfg.RegionalSettings.LocaleCode`

---

## Accessibility Baseline

- Use semantic HTML (`<button>`, `<input>`, `<label>`, `<nav>`, `<main>`)
- Every interactive element has `aria-label` or visible label
- Keyboard navigation works for all critical flows
- Do not rely on color alone to convey status (also use icon or text)
- Maintain WCAG AA contrast minimum for text

---

## Browser and Application Security Rules

### Response Headers (Mandatory)

Every web application must configure these HTTP response headers:

```csharp
// In Program.cs / middleware pipeline:
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"]        = "DENY";
    context.Response.Headers["Referrer-Policy"]        = "strict-origin-when-cross-origin";
    context.Response.Headers["X-XSS-Protection"]      = "0"; // modern browsers use CSP instead
    await next();
});
```

### Content Security Policy (CSP)

- Define a CSP header for every web application.
- Start restrictive: `default-src 'self'`
- Allow specific trusted CDNs and origins explicitly.
- Do NOT use `unsafe-inline` for scripts without a documented justification.
- Do NOT use `unsafe-eval`.
- Test CSP in report-only mode before enforcing.

```csharp
// Example CSP header (adjust allowed origins per project):
"Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"
```

### CORS Rules

- **Restrict CORS to known origins only** — never use `AllowAnyOrigin()` in production.
- Define allowed origins per environment from config (never hardcoded list).
- Do not allow credentials (`AllowCredentials()`) without explicit cross-origin trust justification.

```csharp
// CORRECT:
builder.Services.AddCors(options =>
{
    options.AddPolicy("AppPolicy", policy =>
    {
        policy.WithOrigins(allowedOrigins)  // from config, NOT AllowAnyOrigin
              .AllowedMethods("GET", "POST", "PUT", "DELETE")
              .AllowedHeaders("Content-Type", "Authorization", "X-Correlation-Id");
    });
});

// VIOLATION:
policy.AllowAnyOrigin(); // NEVER in production
```

### CSRF Rules

- Implement CSRF protection on all form-based flows that use cookie authentication.
- Use `[ValidateAntiForgeryToken]` on mutation endpoints where cookie auth is in use.
- For SPA + JWT (no cookies): CSRF is not required, but still enforce `X-Requested-With` header check.

### Cookie Security Rules

```csharp
// CORRECT — all three attributes required for auth cookies:
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.HttpOnly = true;                    // not accessible via JavaScript
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always; // HTTPS only
    options.Cookie.SameSite = SameSiteMode.Strict;    // no cross-site sending
});
```

| Attribute | Rule |
|---|---|
| `HttpOnly` | Always true for auth cookies — prevents JavaScript access |
| `Secure` | Always true — send only over HTTPS |
| `SameSite` | Strict or Lax — never None without documented justification |

---

## Mobile / React Native Security Rules

- Use secure token storage — never store tokens in AsyncStorage without encryption.
- Do NOT hardcode secrets, API keys, or credentials in the mobile app bundle.
- Encrypt local DB (SQLite) if it stores any sensitive or offline-synced data.
- Disable debug logging and verbose error output in production builds.
- Consider **root / jailbreak detection** for apps handling financial, health, or regulated data.
- Consider **certificate pinning** for high-risk apps to prevent man-in-the-middle attacks.
- Clear sensitive in-memory data on app background / foreground transition where possible.
- Wipe local data when user account is disabled or tenant is suspended (on next sync).

---

## Accessibility Baseline (WCAG 2.1 AA)

All applications must meet WCAG 2.1 AA as a minimum standard.

### Mandatory Requirements

- **Keyboard navigation**: every critical user flow must be completable without a mouse.
- **Visible focus indicator**: all interactive elements must show a visible focus ring.
- **Color contrast**: minimum 4.5:1 ratio for normal text, 3:1 for large text (WCAG AA).
- **Form labels**: every input, select, checkbox, and radio must have an explicit `<label>` or `aria-label`.
- **Screen reader support**: use semantic HTML (`<button>`, `<nav>`, `<main>`, `<section>`) and `aria-*` attributes where needed.
- **No color-only status**: status indicators must use icon or text alongside color.
- **Meaningful validation messages**: form errors must identify the field and describe the problem clearly.
- **Accessible modals**: modals must trap focus, support `Escape` to close, and return focus on close.
- **Tab order**: logical tab order must follow visual layout.
- **Responsive design**: all screens verified on desktop (1280px+), tablet (768px), and mobile (375px).

```tsx
// CORRECT — accessible form field pattern:
<div>
  <label htmlFor="email">Email address</label>
  <input
    id="email"
    type="email"
    aria-required="true"
    aria-describedby={fieldErrors.email ? "email-error" : undefined}
  />
  {fieldErrors.email && (
    <span id="email-error" role="alert" className="error">
      {fieldErrors.email}
    </span>
  )}
</div>
```

---

## UI Code Rules

- Remove unused imports before committing
- Keep component logic flat — avoid deeply nested component trees
- Business logic stays in services/hooks, not in JSX render functions
- Centralize API client, auth handling, and permission helpers — never inline them
