'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, Card, Checkbox, Field, Input, Select } from '@/components/ui';
import type { Amenity, Locality, PropertyDetail } from '@/lib/types';
import { createPropertyAction, type PropertyFormState } from './actions';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" fullWidth disabled={pending}>
      {pending ? 'Saving…' : label}
    </Button>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">{children}</h2>;
}

/**
 * Used to create a building and to edit one.
 *
 * The same twenty-odd fields either way, so this takes the action to submit to
 * and the values to start from. A server action passes across the client
 * boundary, which an ordinary function does not — that is what makes one form
 * serve both instead of two that drift apart.
 */
export function PropertyForm({
  orgId,
  localities,
  amenities,
  action: submitAction = createPropertyAction,
  property,
  submitLabel = 'Save and set up rooms',
}: {
  orgId: string;
  localities: Locality[];
  amenities: Amenity[];
  action?: (state: PropertyFormState, form: FormData) => Promise<PropertyFormState>;
  property?: PropertyDetail;
  submitLabel?: string;
}) {
  const [state, action] = useActionState<PropertyFormState, FormData>(submitAction, {});
  const err = (field: string) => state.fieldErrors?.[field];
  const meals = property?.mealPlan;

  const grouped = amenities.reduce<Record<string, Amenity[]>>((acc, amenity) => {
    (acc[amenity.category] ??= []).push(amenity);
    return acc;
  }, {});

  return (
    <form action={action} className="space-y-5 pb-24">
      <input type="hidden" name="orgId" value={orgId} />
      {/* Present only when editing, which is how the action tells the two apart. */}
      {property ? <input type="hidden" name="propertyId" value={property.id} /> : null}
      {state.error ? <Alert>{state.error}</Alert> : null}

      <Card>
        <SectionTitle>The basics</SectionTitle>
        <div className="space-y-4">
          <Field label="PG name" htmlFor="name" required {...(err('name') ? { error: err('name')! } : {})}>
            <Input
              id="name"
              name="name"
              required
              autoFocus
              maxLength={160}
              placeholder="Sunrise Mens PG"
              defaultValue={property?.name ?? ''}
            />
          </Field>

          <Field
            label="Who can stay"
            htmlFor="genderPolicy"
            required
            {...(err('genderPolicy') ? { error: err('genderPolicy')! } : {})}
          >
            <Select id="genderPolicy" name="genderPolicy" required defaultValue={property?.genderPolicy ?? ''}>
              <option value="" disabled>
                Choose…
              </option>
              <option value="MEN">Men only</option>
              <option value="WOMEN">Women only</option>
              <option value="CO_LIVING">Co-living</option>
            </Select>
          </Field>

          <Field label="Type" htmlFor="propertyType">
            <Select id="propertyType" name="propertyType" defaultValue={property?.propertyType ?? 'PG'}>
              <option value="PG">PG</option>
              <option value="HOSTEL">Hostel</option>
              <option value="CO_LIVING">Co-living</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle>Where it is</SectionTitle>
        <div className="space-y-4">
          <Field
            label="Address"
            htmlFor="addressLine1"
            required
            {...(err('addressLine1') ? { error: err('addressLine1')! } : {})}
          >
            <Input
              id="addressLine1"
              name="addressLine1"
              required
              maxLength={200}
              placeholder="Plot 42, Ayyappa Society"
              defaultValue={property?.addressLine1 ?? ''}
            />
          </Field>

          <Field label="Landmark" htmlFor="landmark" hint="Helps tenants find it">
            <Input
              id="landmark"
              name="landmark"
              maxLength={160}
              placeholder="Behind Cyber Towers"
              defaultValue={property?.landmark ?? ''}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Area"
              htmlFor="localityId"
              required
              {...(err('localityId') ? { error: err('localityId')! } : {})}
            >
              <Select id="localityId" name="localityId" required defaultValue={property?.localityId ?? ''}>
                <option value="" disabled>
                  Choose an area…
                </option>
                {localities.map((locality) => (
                  <option key={locality.id} value={locality.id}>
                    {locality.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Pincode"
              htmlFor="pincode"
              required
              {...(err('pincode') ? { error: err('pincode')! } : {})}
            >
              <Input
                id="pincode"
                name="pincode"
                inputMode="numeric"
                maxLength={6}
                required
                placeholder="500081"
                className="tnum"
                defaultValue={property?.pincode ?? ''}
              />
            </Field>
          </div>

          <Field
            label="Contact number"
            htmlFor="contactPhone"
            hint="Shown to tenants once they enquire"
            {...(err('contactPhone') ? { error: err('contactPhone')! } : {})}
          >
            <Input
              id="contactPhone"
              name="contactPhone"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="98765 43210"
              className="tnum"
              defaultValue={property?.contactPhone ?? ''}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle>Food</SectionTitle>
        <div className="space-y-4">
          <Field label="Kitchen" htmlFor="foodType">
            <Select id="foodType" name="foodType" defaultValue={meals?.foodType ?? 'VEG'}>
              <option value="VEG">Vegetarian</option>
              <option value="NON_VEG">Non-vegetarian</option>
              <option value="BOTH">Both</option>
              <option value="NONE">No food provided</option>
            </Select>
          </Field>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Meals included</legend>
            <div className="grid grid-cols-3 gap-2">
              <Checkbox id="breakfast" name="breakfast" label="Breakfast" defaultChecked={meals?.breakfast} />
              <Checkbox id="lunch" name="lunch" label="Lunch" defaultChecked={meals?.lunch} />
              <Checkbox id="dinner" name="dinner" label="Dinner" defaultChecked={meals?.dinner} />
            </div>
          </fieldset>

          <Field
            label="Food charge"
            htmlFor="foodChargeRupees"
            hint="Leave blank if food is included in the rent"
          >
            <Input
              id="foodChargeRupees"
              name="foodChargeRupees"
              inputMode="numeric"
              placeholder="₹ per month"
              className="tnum"
            />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle>Facilities</SectionTitle>
        <div className="space-y-4">
          {Object.entries(grouped).map(([category, items]) => (
            <fieldset key={category}>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {category.toLowerCase()}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {items.map((amenity) => (
                  <Checkbox
                    key={amenity.code}
                    id={`amenity-${amenity.code}`}
                    name="amenityCodes"
                    value={amenity.code}
                    label={amenity.name}
                    defaultChecked={property?.amenityCodes.includes(amenity.code)}
                  />
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>House rules</SectionTitle>
        <Field
          label="Gate closing time"
          htmlFor="gateClosingTime"
          hint="24-hour time. Leave blank if there is no curfew."
          {...(err('gateClosingTime') ? { error: err('gateClosingTime')! } : {})}
        >
          <Input
            id="gateClosingTime"
            name="gateClosingTime"
            placeholder="22:30"
            className="tnum"
            defaultValue={property?.rules?.gateClosingTime ?? ''}
          />
        </Field>
      </Card>

      {/* Sticky so the action is always in thumb reach on a long mobile form. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-[var(--border)] bg-[var(--bg)]/95 p-3 backdrop-blur">
        <div className="mx-auto max-w-5xl">
          <SubmitButton label={submitLabel} />
        </div>
      </div>
    </form>
  );
}
