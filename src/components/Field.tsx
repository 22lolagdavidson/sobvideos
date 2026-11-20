import { useId } from "react";

type Props = {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  defaultValue?: string | number;
  type?: string;
  required?: boolean;
  children?: React.ReactNode; // for <select>: pass <option>s
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
};

/** Labeled input/select with an accessible inline error. */
export function Field({ label, name, error, hint, defaultValue, type = "text", required, children, inputProps }: Props) {
  const id = useId();
  const describedBy = [error ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  const common = { id, name, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy, required };
  return (
    <div className="f-wrap">
      <label className="f" htmlFor={id} style={{ marginBottom: 2 }}>
        {label}
        {children ? (
          <select {...common} defaultValue={defaultValue}>
            {children}
          </select>
        ) : (
          <input {...common} type={type} defaultValue={defaultValue} {...inputProps} />
        )}
      </label>
      {hint && (
        <div id={`${id}-hint`} className="small muted">
          {hint}
        </div>
      )}
      {error && (
        <div id={`${id}-err`} className="field-err">
          {error}
        </div>
      )}
    </div>
  );
}

export function FormMessage({ state }: { state: { ok?: boolean; message?: string } }) {
  if (!state.message) return null;
  return (
    <div className={`notice ${state.ok ? "ok" : "err"}`} role={state.ok ? "status" : "alert"}>
      {state.message}
    </div>
  );
}
