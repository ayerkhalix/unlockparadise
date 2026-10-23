"use client";
import type { ComponentProps } from "react";
import { validateFields } from "@/lib/form-validation";
export function ValidatedForm({ onSubmit, ...props }: ComponentProps<"form">) {
  return (
    <form
      {...props}
      noValidate
      onSubmit={(e) => {
        if (!validateFields(e.currentTarget)) {
          e.preventDefault();
          return;
        }
        onSubmit?.(e);
      }}
    />
  );
}
