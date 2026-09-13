"use client";

import { useActionState, useState } from "react";
import { signupAction, type SignupState } from "./actions";

type UrlRole = "farmer" | "buyer" | "pds-operator" | "admin";

type FormValues = {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  address_line1: string;
  address_line2: string;
  landmark: string;
  village: string;
  district: string;
  state: string;
  pincode: string;
  language: string;
  business_name: string;
  gst_number: string;
  pds_center_id: string;
  admin_code: string;
};

const INITIAL: FormValues = {
  full_name: "",
  email: "",
  phone: "",
  password: "",
  address_line1: "",
  address_line2: "",
  landmark: "",
  village: "",
  district: "",
  state: "",
  pincode: "",
  language: "en",
  business_name: "",
  gst_number: "",
  pds_center_id: "",
  admin_code: "",
};

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
  autoComplete,
  maxLength,
  value,
  onChange,
}: {
  label: string;
  name: keyof FormValues;
  type?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  maxLength?: number;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-[#0F1F1A]">
        {label} {required && <span className="text-[#C62828]">*</span>}
      </label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-[#E4EBE6] px-4 py-3 text-sm outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#EAF5EE]"
      />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-[#E4EBE6] pt-6 first:border-t-0 first:pt-0">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7A74]">
        {title}
      </p>
      <div className="mt-4 space-y-5">{children}</div>
    </div>
  );
}

export default function SignupForm({ role }: { role: UrlRole }) {
  const bound = signupAction.bind(null, role);
  const [state, formAction, isPending] = useActionState<SignupState, FormData>(
    bound,
    null
  );
  const [values, setValues] = useState<FormValues>(INITIAL);

  const set = (key: keyof FormValues) => (v: string) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  return (
    <form action={formAction} className="space-y-6">
      <Section title="Account">
        <Field
          label="Full name"
          name="full_name"
          required
          autoComplete="name"
          value={values.full_name}
          onChange={set("full_name")}
        />

        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="Email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            autoComplete="email"
            value={values.email}
            onChange={set("email")}
          />
          <Field
            label="Mobile number"
            name="phone"
            type="tel"
            required
            placeholder="10-digit number"
            autoComplete="tel"
            maxLength={14}
            value={values.phone}
            onChange={set("phone")}
          />
        </div>

        <Field
          label="Password"
          name="password"
          type="password"
          required
          placeholder="Min 6 characters"
          autoComplete="new-password"
          value={values.password}
          onChange={set("password")}
        />
      </Section>

      <Section title="Address">
        <Field
          label="Address line 1"
          name="address_line1"
          required
          placeholder="House / building / street"
          autoComplete="address-line1"
          value={values.address_line1}
          onChange={set("address_line1")}
        />
        <Field
          label="Address line 2"
          name="address_line2"
          placeholder="Area / locality (optional)"
          autoComplete="address-line2"
          value={values.address_line2}
          onChange={set("address_line2")}
        />
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="Landmark"
            name="landmark"
            placeholder="e.g. Near bus stand"
            value={values.landmark}
            onChange={set("landmark")}
          />
          <Field
            label="Village / Town"
            name="village"
            value={values.village}
            onChange={set("village")}
          />
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <Field
            label="District"
            name="district"
            required
            value={values.district}
            onChange={set("district")}
          />
          <Field
            label="State"
            name="state"
            required
            value={values.state}
            onChange={set("state")}
          />
          <Field
            label="PIN code"
            name="pincode"
            required
            placeholder="6 digits"
            maxLength={6}
            value={values.pincode}
            onChange={set("pincode")}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[#0F1F1A]">
            Preferred language
          </label>
          <select
            name="language"
            value={values.language}
            onChange={(e) => set("language")(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-[#E4EBE6] bg-white px-4 py-3 text-sm outline-none focus:border-[#2E7D32]"
          >
            <option value="en">English</option>
            <option value="hi">हिन्दी (Hindi)</option>
            <option value="kn">ಕನ್ನಡ (Kannada)</option>
          </select>
        </div>
      </Section>

      {role === "buyer" && (
        <Section title="Business">
          <Field
            label="Business name"
            name="business_name"
            placeholder="e.g. Aggarwal Wholesale Pvt Ltd"
            value={values.business_name}
            onChange={set("business_name")}
          />
          <Field
            label="GST number (optional)"
            name="gst_number"
            value={values.gst_number}
            onChange={set("gst_number")}
          />
        </Section>
      )}

      {role === "pds-operator" && (
        <Section title="PDS Centre">
          <Field
            label="PDS Centre ID"
            name="pds_center_id"
            placeholder="e.g. PDS-Nashik-014"
            value={values.pds_center_id}
            onChange={set("pds_center_id")}
          />
        </Section>
      )}

      {role === "admin" && (
        <Section title="Admin verification">
          <Field
            label="Admin signup code"
            name="admin_code"
            required
            placeholder="Provided by the core team"
            value={values.admin_code}
            onChange={set("admin_code")}
          />
        </Section>
      )}

      {state?.error && (
        <div className="rounded-xl border border-[#FFCDD2] bg-[#FFF5F5] p-3 text-sm text-[#C62828]">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-[#1B4D3E] px-6 py-3.5 text-sm font-medium text-white transition-transform hover:scale-[1.01] disabled:opacity-60"
      >
        {isPending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}