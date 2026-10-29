import { useEffect, useRef, useState } from 'react';
import type { FormEvent, Ref } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AuthValidators } from '../../../shared/authValidators';
import { reverseGeocodeDetails } from '../../../services/location/reverseGeocode';
import { CircularProgress } from '../../../shared/CircularProgress';
import {
  addressMapConfig,
  addressTypes,
  lookupPincode,
} from '../../../services/checkout/checkoutModels';
import type { AddressType, DeliveryAddress } from '../../../services/checkout/checkoutModels';
import addAddressMock from './AddAddressDialog.mock.json';
import {
  Scrim,
  CloseButton,
  SectionTitle,
  SectionSubtitle,
  Field,
  FieldLabel,
  Input,
  FieldError,
  TypeChips,
  TypeChip,
  DialogActions,
  OutlinedButton,
  SaveButton,
} from '../shared/checkout.styles';
import {
  Dialog,
  DialogHead,
  DialogBody,
  GpsButton,
  GpsIcon,
  GpsText,
  OrDivider,
  FormSection,
  FormSectionHead,
  FormSectionTrailing,
  FormGrid,
  MobileInputWrap,
  MobilePrefix,
  PincodeInputWrap,
  PincodeSuffix,
  FieldHelper,
  MapFrame,
  MapPin,
  MapHint,
  DefaultToggle,
  DefaultToggleText,
  Switch,
} from './AddAddressDialog.styles';

const copy = addAddressMock;

type TextField = 'fullName' | 'mobile' | 'pincode' | 'city' | 'state' | 'house' | 'area';
type PincodeStatus = 'idle' | 'loading' | 'found' | 'notFound';

const emptyForm: Record<TextField, string> = {
  fullName: '',
  mobile: '',
  pincode: '',
  city: '',
  state: '',
  house: '',
  area: '',
};

const required = (value: string, label: string) =>
  value.trim() === '' ? `${label} is required` : null;

/** Same validators as Flutter `AddAddressScreen`. */
function validate(values: Record<TextField, string>) {
  const pincode = values.pincode.trim();
  const errors: Record<TextField, string | null> = {
    fullName: AuthValidators.fullName(values.fullName),
    mobile: AuthValidators.mobile(values.mobile),
    pincode:
      pincode === ''
        ? copy.errors.pincodeRequired
        : /^[1-9]\d{5}$/.test(pincode)
          ? null
          : copy.errors.pincodeInvalid,
    city: required(values.city, copy.fields.city),
    state: required(values.state, copy.fields.state),
    house: required(values.house, copy.fields.house),
    area: required(values.area, copy.errors.areaLabel),
  };
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v)) as Partial<
    Record<TextField, string>
  >;
}

interface AddAddressDialogProps {
  onCancel: () => void;
  /** Resolves false when saving failed (the dialog stays open). */
  onSave: (address: DeliveryAddress) => Promise<boolean> | void;
  /** Called after the mocked GPS fix, for the page's snackbar. */
  onLocated?: (message: string) => void;
}

/**
 * Web version of Flutter `AddAddressScreen`, shown as a dialog over checkout
 * step 2: GPS auto-fill (mocked), contact details, address with pincode
 * auto-fill, an optional pin-location map, "Save Address As" and default.
 */
export function AddAddressDialog({ onCancel, onSave, onLocated }: AddAddressDialogProps) {
  const [values, setValues] = useState(emptyForm);
  const [type, setType] = useState<AddressType>('home');
  const [customLabel, setCustomLabel] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [pinStatus, setPinStatus] = useState<PincodeStatus>('idle');
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const firstFieldRef = useRef<HTMLInputElement>(null);
  const houseRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const pincodeRef = useRef('');
  const mounted = useRef(true);

  const errors = submitted ? validate(values) : {};

  useEffect(() => {
    mounted.current = true;
    firstFieldRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      mounted.current = false;
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onCancel]);

  const setField = (key: TextField, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  /** Flutter `_onPincodeChanged` — look up City/State once 6 digits are in. */
  const onPincodeChanged = async (raw: string) => {
    const value = raw.replace(/\D/g, '').slice(0, 6);
    pincodeRef.current = value;
    setField('pincode', value);
    if (value.length < 6) {
      setPinStatus('idle');
      return;
    }
    setPinStatus('loading');
    const result = await lookupPincode(value);
    // Ignore stale lookups if the user kept typing.
    if (!mounted.current || pincodeRef.current !== value) return;
    if (!result) {
      setPinStatus('notFound');
      return;
    }
    setPinStatus('found');
    setValues((prev) => ({ ...prev, city: result.city, state: result.state }));
  };

  /** Uses the device location, moves the pin there and fills in what the map knows about the place. */
  const locateMe = async () => {
    if (locating) return;
    if (!navigator.geolocation) { onLocated?.('Location is not available on this device.'); return; }
    setLocating(true);
    try {
      const pos = await new Promise<GeolocationPosition>((ok, fail) =>
        navigator.geolocation.getCurrentPosition(ok, fail, { enableHighAccuracy: true, timeout: 15000 }));
      if (!mounted.current) return;
      const at: [number, number] = [pos.coords.latitude, pos.coords.longitude];
      mapRef.current?.setView(at, addressMapConfig.gpsZoom);
      const place = await reverseGeocodeDetails(at[0], at[1]).catch(() => null);
      if (!mounted.current) return;
      if (place) {
        if (place.pincode) pincodeRef.current = place.pincode;
        setValues((prev) => ({
          ...prev,
          area: place.area ?? prev.area,
          pincode: place.pincode ?? prev.pincode,
          city: place.city ?? prev.city,
          state: place.state ?? prev.state,
        }));
        if (place.pincode) setPinStatus('found');
      }
      onLocated?.(copy.locationFound);
      houseRef.current?.focus();
    } catch {
      onLocated?.('Allow location access, or fill in the address.');
    } finally {
      if (mounted.current) setLocating(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSubmitted(true);
    if (Object.keys(validate(values)).length > 0) return;
    setSaving(true);
    const center = mapRef.current?.getCenter();
    const ok = await onSave({
      id: `addr-${Date.now()}`,
      fullName: values.fullName.trim(),
      mobile: values.mobile.trim(),
      pincode: values.pincode.trim(),
      city: values.city.trim(),
      state: values.state.trim(),
      house: values.house.trim(),
      area: values.area.trim(),
      type,
      customLabel: type === 'other' ? customLabel.trim() : undefined,
      isDefault,
      location: center ? [center.lat, center.lng] : undefined,
    });
    if (ok === false && mounted.current) setSaving(false);
  };

  const pincodeHelper =
    pinStatus === 'found'
      ? copy.pincode.found
      : pinStatus === 'notFound'
        ? copy.pincode.notFound
        : copy.pincode.idle;

  const textInput = (key: TextField, extra?: { ref?: Ref<HTMLInputElement> }) => (
    <Input
      ref={extra?.ref}
      value={values[key]}
      autoComplete="off"
      aria-invalid={errors[key] ? true : undefined}
      onChange={(e) => setField(key, e.target.value)}
    />
  );

  return (
    <Scrim onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <Dialog
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-address-title"
        noValidate
        onSubmit={submit}
      >
        <DialogHead>
          <div>
            <SectionTitle id="add-address-title">{copy.title}</SectionTitle>
            <SectionSubtitle>{copy.subtitle}</SectionSubtitle>
          </div>
          <CloseButton type="button" aria-label={copy.cancel} onClick={onCancel}>
            <i className="pi pi-times" aria-hidden />
          </CloseButton>
        </DialogHead>

        <DialogBody>
          <GpsButton type="button" onClick={locateMe} disabled={locating}>
            <GpsIcon>
              {locating ? (
                <CircularProgress size={20} strokeWidth={2.5} />
              ) : (
                <i className="pi pi-compass" aria-hidden />
              )}
            </GpsIcon>
            <GpsText>
              <strong>{locating ? copy.gps.locating : copy.gps.title}</strong>
              <span>{copy.gps.subtitle}</span>
            </GpsText>
            <i className="pi pi-chevron-right" aria-hidden />
          </GpsButton>

          <OrDivider>
            <span>{copy.orManually}</span>
          </OrDivider>

          <FormSection>
            <FormSectionHead>
              <i className="pi pi-user" aria-hidden />
              {copy.sections.contact}
            </FormSectionHead>
            <FormGrid>
              <Field>
                <FieldLabel>{copy.fields.fullName}</FieldLabel>
                {textInput('fullName', { ref: firstFieldRef })}
                {errors.fullName && <FieldError role="alert">{errors.fullName}</FieldError>}
              </Field>
              <Field>
                <FieldLabel>{copy.fields.mobile}</FieldLabel>
                <MobileInputWrap>
                  <MobilePrefix>+91</MobilePrefix>
                  <Input
                    value={values.mobile}
                    inputMode="tel"
                    autoComplete="off"
                    aria-invalid={errors.mobile ? true : undefined}
                    onChange={(e) =>
                      setField('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))
                    }
                  />
                </MobileInputWrap>
                {errors.mobile && <FieldError role="alert">{errors.mobile}</FieldError>}
              </Field>
            </FormGrid>
          </FormSection>

          <FormSection>
            <FormSectionHead>
              <i className="pi pi-home" aria-hidden />
              {copy.sections.address}
            </FormSectionHead>
            <FormGrid>
              <Field $wide>
                <FieldLabel>{copy.fields.pincode}</FieldLabel>
                <PincodeInputWrap>
                  <Input
                    value={values.pincode}
                    inputMode="numeric"
                    autoComplete="off"
                    aria-invalid={errors.pincode ? true : undefined}
                    onChange={(e) => onPincodeChanged(e.target.value)}
                  />
                  <PincodeSuffix $status={pinStatus} aria-hidden>
                    {pinStatus === 'loading' && <CircularProgress size={18} strokeWidth={2.5} />}
                    {pinStatus === 'found' && <i className="pi pi-check-circle" />}
                    {pinStatus === 'notFound' && <i className="pi pi-info-circle" />}
                  </PincodeSuffix>
                </PincodeInputWrap>
                {errors.pincode ? (
                  <FieldError role="alert">{errors.pincode}</FieldError>
                ) : (
                  <FieldHelper $status={pinStatus}>{pincodeHelper}</FieldHelper>
                )}
              </Field>
              <Field>
                <FieldLabel>{copy.fields.city}</FieldLabel>
                {textInput('city')}
                {errors.city && <FieldError role="alert">{errors.city}</FieldError>}
              </Field>
              <Field>
                <FieldLabel>{copy.fields.state}</FieldLabel>
                {textInput('state')}
                {errors.state && <FieldError role="alert">{errors.state}</FieldError>}
              </Field>
              <Field $wide>
                <FieldLabel>{copy.fields.house}</FieldLabel>
                {textInput('house', { ref: houseRef })}
                {errors.house && <FieldError role="alert">{errors.house}</FieldError>}
              </Field>
              <Field $wide>
                <FieldLabel>{copy.fields.area}</FieldLabel>
                {textInput('area')}
                {errors.area && <FieldError role="alert">{errors.area}</FieldError>}
              </Field>
            </FormGrid>
          </FormSection>

          <FormSection>
            <FormSectionHead>
              <i className="pi pi-map" aria-hidden />
              {copy.sections.pin}
              <FormSectionTrailing>{copy.optional}</FormSectionTrailing>
            </FormSectionHead>
            <MapFrame>
              <MapContainer
                ref={mapRef}
                center={addressMapConfig.defaultCenter}
                zoom={addressMapConfig.zoom}
                zoomControl={false}
                attributionControl={false}
              >
                <TileLayer url={copy.tileUrl} />
              </MapContainer>
              <MapPin aria-hidden>
                <i className="pi pi-map-marker" />
              </MapPin>
              <MapHint>{copy.mapHint}</MapHint>
            </MapFrame>
          </FormSection>

          <FormSection>
            <FormSectionHead>
              <i className="pi pi-bookmark" aria-hidden />
              {copy.sections.saveAs}
            </FormSectionHead>
            <TypeChips role="radiogroup" aria-label={copy.sections.saveAs}>
              {addressTypes.map((option) => (
                <TypeChip
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={type === option.value}
                  $selected={type === option.value}
                  onClick={() => setType(option.value)}
                >
                  <i className={`pi ${option.icon}`} aria-hidden />
                  {option.label}
                </TypeChip>
              ))}
            </TypeChips>
            {type === 'other' && (
              <Field $wide>
                <FieldLabel>{copy.fields.customLabel}</FieldLabel>
                <Input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
              </Field>
            )}
            <DefaultToggle>
              <DefaultToggleText>
                <strong>{copy.defaultToggle.title}</strong>
                <span>{copy.defaultToggle.subtitle}</span>
              </DefaultToggleText>
              <Switch
                type="checkbox"
                role="switch"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
            </DefaultToggle>
          </FormSection>
        </DialogBody>

        <DialogActions>
          <OutlinedButton type="button" onClick={onCancel}>
            {copy.cancel}
          </OutlinedButton>
          <SaveButton type="submit" disabled={saving}>
            {saving ? (
              <CircularProgress size={18} strokeWidth={2.5} color="currentColor" />
            ) : (
              <i className="pi pi-check" aria-hidden />
            )}
            {copy.save}
          </SaveButton>
        </DialogActions>
      </Dialog>
    </Scrim>
  );
}
