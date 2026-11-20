"use client";
import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";

/**
 * Like useActionState, but submits via onSubmit so React 19 does NOT reset the form
 * afterwards. Edit forms keep exactly what the user typed (including <select>s, which
 * a reset would put back to their first-render value) whether the save worked or not.
 * Pass resetOnOk for "add" forms that should clear after a successful submit.
 */
export function useFormAction<S extends { ok?: boolean }>(
  action: (s: Awaited<S>, fd: FormData) => Promise<S>,
  initial: Awaited<S>,
  opts: { resetOnOk?: boolean } = {},
) {
  const [state, dispatch, pending] = useActionState<S, FormData>(action, initial);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (opts.resetOnOk && state.ok) ref.current?.reset();
  }, [state, opts.resetOnOk]);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };
  return [state, onSubmit, pending, ref] as const;
}
