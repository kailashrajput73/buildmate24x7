import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { isLocked } from '../../../services/profile/profileModels';
import type { ProfileDocument, VerificationStatus } from '../../../services/profile/profileModels';
import type { Validator } from '../../../services/profile/profileValidators';
import mock from './Profile.mock.json';
import {
  Card,
  MobileHit,
  CardHead,
  IconTile,
  HeadText,
  CardTitle,
  CardSubtitle,
  Badge,
  EditButton,
  Chevron,
  CardDivider,
  MobileRows,
  Row,
  RowLabel,
  RowValue,
  NotEditableChip,
  FieldGrid,
  Field,
  FieldLabel,
  ValueBox,
  Input,
  TextArea,
  FieldHelper,
  DocBox,
  DocInline,
  DocIcon,
  DocText,
  DocAction,
  HiddenFileInput,
  ApprovalNote,
  FormActions,
  SecondaryButton,
  PrimaryButton,
} from './Profile.styles';

const { _buttons, _statusLabels } = mock;

export interface SectionField {
  key: string;
  label: string;
  value: string;
  validator?: Validator;
  /** Shown but never editable (e.g. mobile number). */
  readOnly?: boolean;
  multiline?: boolean;
  uppercase?: boolean;
  digitsOnly?: boolean;
  maxLength?: number;
  type?: 'text' | 'email';
  inputMode?: 'text' | 'email' | 'numeric';
  /** Edit form starts with this instead of `value` (e.g. masked numbers). */
  editInitial?: string;
  placeholder?: string;
}

export type SectionValues = Record<string, string>;

interface ProfileSectionProps {
  icon: string;
  title: string;
  subtitle: string;
  status?: VerificationStatus;
  fields: SectionField[];
  document?: ProfileDocument;
  /** Web grid columns at ≥ lg (fields + document). */
  cols: number;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (values: SectionValues, file: File | null) => Promise<void>;
  onLocked: () => void;
  onPreview: (document: ProfileDocument) => void;
}

const formatDate = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

function DocumentSummary({
  document,
  onPreview,
}: {
  document: ProfileDocument;
  onPreview?: (d: ProfileDocument) => void;
}) {
  return (
    <>
      <DocIcon className="pi pi-file-pdf" aria-hidden />
      <DocText>
        <strong title={document.fileName}>{document.fileName}</strong>
        <small>
          {mock._uploadedOnPrefix}
          {formatDate(document.uploadedOn)}
        </small>
      </DocText>
      {onPreview && (
        <DocAction
          type="button"
          title={_buttons.preview}
          aria-label={`${_buttons.preview}: ${document.fileName}`}
          onClick={() => onPreview(document)}
        >
          <i className="pi pi-eye" aria-hidden />
        </DocAction>
      )}
    </>
  );
}

/**
 * One profile card (Flutter `ProfileSectionCard`). Mobile: label/value rows,
 * whole card taps into edit. Web (≥ md): boxed read-only fields in a grid with
 * an Edit button; editing happens inline. Approved sections are locked.
 */
export function ProfileSection({
  icon,
  title,
  subtitle,
  status,
  fields,
  document,
  cols,
  editing,
  onEdit,
  onCancel,
  onSave,
  onLocked,
  onPreview,
}: ProfileSectionProps) {
  const locked = status !== undefined && isLocked(status);
  const requestEdit = () => (locked ? onLocked() : onEdit());

  return (
    <Card $editing={editing} $pending={status === 'pending'} aria-label={title}>
      {!editing && (
        <MobileHit type="button" aria-label={`${_buttons.edit} ${title}`} onClick={requestEdit} />
      )}

      <CardHead>
        <IconTile>
          <i className={`pi ${icon}`} aria-hidden />
        </IconTile>
        <HeadText>
          <CardTitle>{title}</CardTitle>
          <CardSubtitle>{subtitle}</CardSubtitle>
        </HeadText>
        {status && (
          <Badge $status={status}>
            <i
              className={`pi ${status === 'approved' ? 'pi-check-circle' : 'pi-clock'}`}
              aria-hidden
            />
            {_statusLabels[status]}
          </Badge>
        )}
        {!editing && (
          <EditButton
            type="button"
            disabled={locked}
            title={locked ? `${title}${mock._snack.lockedSuffix}` : undefined}
            onClick={onEdit}
          >
            <i className={`pi ${locked ? 'pi-lock' : 'pi-pencil'}`} aria-hidden />
            {_buttons.edit}
          </EditButton>
        )}
        {!editing && (
          <Chevron
            $locked={locked}
            className={`pi ${locked ? 'pi-lock' : 'pi-chevron-right'}`}
            aria-hidden
          />
        )}
      </CardHead>

      <CardDivider />

      {editing ? (
        <EditForm
          fields={fields}
          document={document}
          cols={cols}
          requiresApproval={status !== undefined}
          onCancel={onCancel}
          onSave={onSave}
        />
      ) : (
        <>
          <MobileRows>
            {fields.map((f) => (
              <Row key={f.key}>
                <RowLabel>{f.label}</RowLabel>
                <RowValue>
                  {f.value || '—'}
                  {f.readOnly && (
                    <NotEditableChip>
                      <i className="pi pi-lock" aria-hidden />
                      {mock._notEditable}
                    </NotEditableChip>
                  )}
                </RowValue>
              </Row>
            ))}
            {document && (
              <Row>
                <RowLabel>{mock._documentLabel}</RowLabel>
                <RowValue>
                  <DocInline>
                    <DocumentSummary document={document} />
                  </DocInline>
                </RowValue>
              </Row>
            )}
          </MobileRows>

          <FieldGrid $cols={cols} $viewOnly>
            {fields.map((f) => (
              <Field key={f.key}>
                <FieldLabel as="span">
                  {f.label}
                  {!f.readOnly && <span> *</span>}
                </FieldLabel>
                <ValueBox $locked={f.readOnly} $multiline={f.multiline}>
                  {f.value || '—'}
                  {f.readOnly && <i className="pi pi-lock" aria-hidden />}
                </ValueBox>
                {f.readOnly && <FieldHelper>{mock._notEditable}</FieldHelper>}
              </Field>
            ))}
            {document && (
              <Field>
                <FieldLabel as="span">
                  {mock._documentLabel}
                  <span> *</span>
                </FieldLabel>
                <DocBox>
                  <DocumentSummary document={document} onPreview={onPreview} />
                </DocBox>
              </Field>
            )}
          </FieldGrid>
        </>
      )}
    </Card>
  );
}

interface EditFormProps {
  fields: SectionField[];
  document?: ProfileDocument;
  cols: number;
  requiresApproval: boolean;
  onCancel: () => void;
  onSave: (values: SectionValues, file: File | null) => Promise<void>;
}

function EditForm({ fields, document, cols, requiresApproval, onCancel, onSave }: EditFormProps) {
  const [values, setValues] = useState<SectionValues>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.editInitial ?? f.value])),
  );
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const change = (f: SectionField, raw: string) => {
    let next = f.uppercase ? raw.toUpperCase() : raw;
    if (f.digitsOnly) next = next.replace(/\D/g, '');
    setValues((v) => ({ ...v, [f.key]: next }));
    // Re-validate live once a field has shown an error (Flutter autovalidate after submit).
    if (errors[f.key]) setErrors((e) => ({ ...e, [f.key]: f.validator?.(next) ?? null }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors = Object.fromEntries(
      fields.filter((f) => !f.readOnly).map((f) => [f.key, f.validator?.(values[f.key]) ?? null]),
    );
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    setSaving(true);
    try {
      const trimmed = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]));
      await onSave(trimmed, file);
    } finally {
      setSaving(false);
    }
  };

  const shownDocument: ProfileDocument | undefined = file
    ? { fileName: file.name, uploadedOn: new Date().toISOString().slice(0, 10) }
    : document;

  return (
    <form noValidate onSubmit={submit}>
      {requiresApproval && (
        <ApprovalNote>
          <i className="pi pi-info-circle" aria-hidden />
          {mock._approvalNote}
        </ApprovalNote>
      )}

      <FieldGrid $cols={cols}>
        {fields.map((f) => {
          const id = `profile-${f.key}`;
          const error = errors[f.key];
          const common = {
            id,
            value: values[f.key],
            disabled: f.readOnly || saving,
            placeholder: f.placeholder,
            maxLength: f.maxLength,
            $invalid: Boolean(error),
            'aria-invalid': Boolean(error),
            'aria-describedby': error ? `${id}-error` : undefined,
          };
          return (
            <Field key={f.key}>
              <FieldLabel htmlFor={id}>
                {f.label}
                {!f.readOnly && <span> *</span>}
              </FieldLabel>
              {f.multiline ? (
                <TextArea {...common} rows={3} onChange={(e) => change(f, e.target.value)} />
              ) : (
                <Input
                  {...common}
                  type={f.type ?? 'text'}
                  inputMode={f.inputMode}
                  autoCapitalize={f.uppercase ? 'characters' : undefined}
                  onChange={(e) => change(f, e.target.value)}
                />
              )}
              {error ? (
                <FieldHelper $error id={`${id}-error`}>
                  {error}
                </FieldHelper>
              ) : (
                f.readOnly && <FieldHelper>{mock._notEditable}</FieldHelper>
              )}
            </Field>
          );
        })}

        {shownDocument && (
          <Field>
            <FieldLabel as="span">
              {mock._documentLabel}
              <span> *</span>
            </FieldLabel>
            <DocBox>
              <DocumentSummary document={shownDocument} />
              <DocAction type="button" disabled={saving} onClick={() => fileInput.current?.click()}>
                <i className="pi pi-upload" aria-hidden />
                {mock._replaceDocument}
              </DocAction>
              <HiddenFileInput
                ref={fileInput}
                type="file"
                accept={mock._documentAccept}
                onChange={(e) => setFile(e.target.files?.[0] ?? file)}
              />
            </DocBox>
          </Field>
        )}
      </FieldGrid>

      <FormActions>
        <SecondaryButton type="button" disabled={saving} onClick={onCancel}>
          {_buttons.cancel}
        </SecondaryButton>
        <PrimaryButton type="submit" disabled={saving} $busy={saving}>
          {saving && <i className="pi pi-spinner" aria-hidden />}
          {saving ? _buttons.saving : requiresApproval ? _buttons.submit : _buttons.save}
        </PrimaryButton>
      </FormActions>
    </form>
  );
}
