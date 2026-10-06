import { useState } from 'react';

import { isValidTimeValue } from './timeUtils.js';

function normalizeInitialTime(value) {
  const input = String(value || '').slice(0, 5);
  const raw = /^([01]?\d|2[0-3]):[0-5]\d$/.test(input) ? input.padStart(5, '0') : input;
  return isValidTimeValue(raw) ? raw : '00:00';
}

function cleanTimeInput(value) {
  return String(value || '').replace(/[^0-9:]/g, '').slice(0, 5);
}

export default function TimeSelect({ defaultValue, label = 'Hora', name = 'hora', required = true }) {
  const [value, setValue] = useState(defaultValue || required ? normalizeInitialTime(defaultValue) : '');

  return (
    <label>
      {label}
      <input
        inputMode="numeric"
        maxLength="5"
        name={name}
        onChange={(event) => setValue(cleanTimeInput(event.target.value))}
        onBlur={() => { if (value) setValue(normalizeInitialTime(value)); }}
        pattern="^([01]?\d|2[0-3]):[0-5]\d$"
        placeholder="HH:mm"
        required={required}
        title="Hora válida: 9:20 o 09:20."
        value={value}
      />
    </label>
  );
}
