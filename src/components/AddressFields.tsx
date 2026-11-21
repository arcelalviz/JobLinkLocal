'use client';
import { OLONGAPO_BARANGAYS } from '@/lib/olongapo';

export function AddressFields({
  barangay, addressLine, onBarangayChange, onAddressLineChange, required = true,
  label = 'Street, building, purok or sitio'
}: {
  barangay: string;
  addressLine: string;
  onBarangayChange: (value: string) => void;
  onAddressLineChange: (value: string) => void;
  required?: boolean;
  label?: string;
}) {
  return <div className="local-address-fields">
    <p className="local-address-context">Olongapo City, Zambales, Philippines</p>
    <div className="form-two">
      <label className="form-field"><span>Barangay</span>
        <select value={barangay} onChange={event => onBarangayChange(event.target.value)} required={required}>
          <option value="">Select barangay</option>
          {OLONGAPO_BARANGAYS.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label className="form-field"><span>{label}</span>
        <input value={addressLine} onChange={event => onAddressLineChange(event.target.value)}
          placeholder="House/lot, street or purok" maxLength={180} required={required} />
      </label>
    </div>
  </div>;
}
